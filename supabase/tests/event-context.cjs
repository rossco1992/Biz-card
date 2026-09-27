const { PGlite } = require("@electric-sql/pglite");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const assert = require("node:assert/strict");

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select current_setting('test.uid',true)::uuid$$;
      grant usage on schema auth to authenticated;
    `);

    for (const name of ["0001_initial_schema", "0002_owner_onboarding", "0005_event_context_and_signatures"]) {
      const sql = readFileSync(new URL(`../migrations/${name}.sql`, "file://" + __filename), "utf8")
        .replace("create extension if not exists pgcrypto;", "");
      await db.exec(sql);
    }

    await db.exec("grant select,insert,update,delete on all tables in schema public to authenticated");

    const [a, b, pa, pb, ea, eb, connection] = Array.from({ length: 7 }, randomUUID);
    await db.query("insert into auth.users values ($1),($2)", [a, b]);
    await db.query(
      "insert into profiles(id,user_id,slug,full_name,email) values ($1,$2,'alice','Alice','a@example.com'),($3,$4,'bob','Bob','b@example.com')",
      [pa, a, pb, b],
    );
    await db.query(
      "insert into events(id,profile_id,name,location) values ($1,$2,'SaaStr','San Francisco, CA'),($3,$4,'Other Event','New York, NY')",
      [ea, pa, eb, pb],
    );

    await db.query("select set_config('test.uid',$1,false)", [a]);
    await db.exec("set role authenticated");

    assert.deepEqual((await db.query("select id from events order by id")).rows.map((row) => row.id), [ea]);
    await assert.rejects(
      db.query("update profiles set active_event_id=$1 where id=$2", [eb, pa]),
      /Active event must belong to the same profile/,
    );
    await db.query("update profiles set active_event_id=$1 where id=$2", [ea, pa]);

    await db.exec("reset role");
    await db.query(
      "insert into connections(id,profile_id,event_id,first_name,email,consent_at,event_name_snapshot,event_location_snapshot) values($1,$2,$3,'Mike','mike@example.com',now(),'SaaStr','San Francisco, CA')",
      [connection, pa, ea],
    );
    await db.query("delete from events where id=$1", [ea]);

    assert.equal((await db.query("select active_event_id from profiles where id=$1", [pa])).rows[0].active_event_id, null);
    const snapshot = (await db.query(
      "select event_id,event_name_snapshot,event_location_snapshot from connections where id=$1",
      [connection],
    )).rows[0];
    assert.deepEqual(snapshot, {
      event_id: null,
      event_name_snapshot: "SaaStr",
      event_location_snapshot: "San Francisco, CA",
    });

    console.log("PASS: event ownership is isolated and connection snapshots survive event deletion");
  } finally {
    await db.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
