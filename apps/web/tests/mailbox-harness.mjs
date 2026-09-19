import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
const require = createRequire(import.meta.url);
const web = fileURLToPath(new URL("../", import.meta.url));
export function loadSource(entry, mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (mocks[file]) return mocks[file];
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const localRequire = name => name.startsWith("@/") ? load(resolve(web, name.slice(2) + ".ts")) : name.startsWith(".") ? load(resolve(dirname(file), name + ".ts")) : require(name);
    new Function("require", "module", "exports", source)(localRequire, module, module.exports);
    return module.exports;
  }
  return load(resolve(web, entry));
}
export const adminPath = resolve(web, "lib/supabase-admin.ts");
export async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';`);
  for (const name of ["0001_initial_schema", "0002_owner_onboarding", "0003_connected_email"]) {
    // PGlite has core gen_random_uuid; it does not ship the separate pgcrypto extension.
    const sql = readFileSync(new URL(`../../../supabase/migrations/${name}.sql`, import.meta.url), "utf8").replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
  }
  return db;
}
// A small PostgREST-shaped adapter exercises real migration SQL with the production handlers.
export function adminFor(db, users = {}) {
  const quote = name => '"' + name.replaceAll('"', '""') + '"';
  return {
    auth: { getUser: async token => ({ data: { user: users[token] || null }, error: users[token] ? null : new Error("Invalid token") }) },
    from(table) {
      let operation = "select", values, columns = "*", filters = [], one = false;
      const builder = {
        select(c = "*") { columns = c; return this; },
        insert(v) { operation = "insert"; values = v; return this; },
        update(v) { operation = "update"; values = v; return this; },
        delete() { operation = "delete"; return this; },
        eq(k,v) { filters.push([k,"=",v]); return this; },
        neq(k,v) { filters.push([k,"<>",v]); return this; },
        gt(k,v) { filters.push([k,">",v]); return this; },
        maybeSingle() { one = true; return this; }, single() { one = true; return this; },
        async then(ok, fail) {
          try {
            const params = [];
            const param = v => { params.push(v); return `$${params.length}`; };
            const cols = columns === "*" ? "*" : columns.split(",").map(quote).join(",");
            let sql;
            if (operation === "insert") sql = `insert into public.${quote(table)} (${Object.keys(values).map(quote).join(",")}) values (${Object.values(values).map(param).join(",")})`;
            else if (operation === "update") sql = `update public.${quote(table)} set ${Object.entries(values).map(([k,v]) => `${quote(k)}=${param(v)}`).join(",")}`;
            else sql = operation === "delete" ? `delete from public.${quote(table)}` : `select ${cols} from public.${quote(table)}`;
            if (filters.length) sql += " where " + filters.map(([k,op,v]) => `${quote(k)} ${op} ${param(v)}`).join(" and ");
            if (operation !== "select") sql += ` returning ${cols}`;
            const result = await db.query(sql, params);
            return ok({ data: one ? result.rows[0] || null : result.rows, error: null });
          } catch (error) { return ok({ data: null, error }); }
        },
      };
      return builder;
    },
    async rpc(name, args) {
      try {
        const keys = Object.keys(args);
        const { rows } = await db.query(`select * from public.${quote(name)}(${keys.map((k,i) => `${quote(k)} => $${i+1}`).join(",")})`, Object.values(args));
        return { data: rows, error: null };
      } catch (error) { return { data: null, error }; }
    },
  };
}
