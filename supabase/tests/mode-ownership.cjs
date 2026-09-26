const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
(async () => {
 const db = new PGlite();
 try {
 await db.exec(`create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$select current_setting('test.uid',true)::uuid$$; grant usage on schema auth to authenticated;`);
 await db.exec(readFileSync(new URL('../migrations/0001_initial_schema.sql', 'file://' + __filename), 'utf8').replace('create extension if not exists pgcrypto;', ''));
 await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated');
 const [a,b,pa,pb,ma,mb,c,f] = Array.from({length:8},randomUUID);
 await db.query('insert into auth.users values ($1),($2)',[a,b]);
 await db.query("insert into profiles(id,user_id,slug,full_name,email) values ($1,$2,'alice','Alice','a@example.com'),($3,$4,'bob','Bob','b@example.com')",[pa,a,pb,b]);
 await db.query("insert into modes(id,profile_id,name,kind,subject_template,body_template) values ($1,$2,'A','event','subject','body'),($3,$4,'B','event','subject','body')",[ma,pa,mb,pb]);
 await db.query("insert into connections(id,profile_id,mode_id,first_name,email,consent_at,mode_name_snapshot) values($1,$2,$3,'Test','test@example.com',now(),'A')",[c,pa,ma]);
 await db.query("insert into followups(id,connection_id,profile_id,mode_id,recipient_email,send_at,subject_snapshot,body_snapshot) values($1,$2,$3,$4,'test@example.com',now(),'saved subject','saved body')",[f,c,pa,ma]);
 await db.query("select set_config('test.uid',$1,false)",[a]); await db.exec('set role authenticated');
 assert.deepEqual((await db.query('select id from modes')).rows.map(r=>r.id),[ma]);
 assert.equal((await db.query('delete from modes where id=$1 returning id',[mb])).rows.length,0);
 await assert.rejects(db.query("insert into modes(profile_id,name,kind,subject_template,body_template) values($1,'Intrusion','event','x','x')",[pb]),/row-level security/);
 assert.equal((await db.query('delete from modes where id=$1 returning id',[ma])).rows.length,1);
 const connection=(await db.query('select mode_id,mode_name_snapshot from connections where id=$1',[c])).rows[0];
 assert.deepEqual(connection,{mode_id:null,mode_name_snapshot:'A'});
 const followup=(await db.query('select mode_id,status,subject_snapshot,body_snapshot from followups where id=$1',[f])).rows[0];
 assert.deepEqual(followup,{mode_id:null,status:'scheduled',subject_snapshot:'saved subject',body_snapshot:'saved body'});
 console.log('PASS: account isolation, cross-account insert/delete blocked, own-mode delete preserves contacts and scheduled snapshots');
 } finally { await db.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
