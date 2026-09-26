const {PGlite}=require(process.cwd()+'/node_modules/@electric-sql/pglite');
const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema vault; create table vault.decrypted_secrets(name text, decrypted_secret text); create schema net; create table net.calls(id bigserial,url text,headers jsonb,timeout_ms int); create function net.http_get(url text,headers jsonb,timeout_milliseconds int) returns bigint language sql as $$insert into net.calls(url,headers,timeout_ms) values(url,headers,timeout_milliseconds) returning id$$; create schema cron; create table cron.job(jobid bigserial,jobname text unique,schedule text,command text); create function cron.schedule(n text,s text,c text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values(n,s,c) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid$$;`);
 const sql=fs.readFileSync('supabase/operations/install_followup_scheduler.sql','utf8').replace(/^create extension.*;$/gm,'');
 await assert.rejects(db.exec(sql),/Store the production CRON_SECRET/); await db.exec('rollback');
 await db.exec(`insert into vault.decrypted_secrets values('knctd_followup_cron_secret',repeat('x',64));`);
 await db.exec(sql);await db.exec(sql);
 assert.equal((await db.query('select count(*)::int as n from cron.job')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int as n from net.calls')).rows[0].n,0);
 await db.query('select knctd_scheduler.dispatch_followups()');
 const c=(await db.query('select * from net.calls')).rows[0];assert.equal(c.url,'https://www.getknctd.com/api/jobs/followups');assert.equal(c.headers.Authorization,'Bearer '+'x'.repeat(64));assert.equal(c.timeout_ms,65000);
 assert.equal((await db.query('select count(*)::int as n from knctd_scheduler.requests')).rows[0].n,1);
 await db.exec('set role anon');await assert.rejects(db.query('select knctd_scheduler.dispatch_followups()'),/permission denied/);await db.exec('reset role');
 await db.exec('set role authenticated');await assert.rejects(db.query('select knctd_scheduler.dispatch_followups()'),/permission denied/);await db.exec('reset role');
 console.log('PASS: missing-secret rollback, idempotent schedule, no send on install, authenticated destination/timeout, request audit, anon and authenticated denied. pg_cron/pg_net interfaces stubbed; live cadence still needs verification.');await db.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
