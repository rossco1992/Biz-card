import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server.js";
import { loadSource, database, adminFor, adminPath } from "./mailbox-harness.mjs";
process.env.MAILBOX_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.MAILBOX_APP_URL = "https://bizcard.example";
process.env.GOOGLE_MAIL_CLIENT_ID = "google-client";
process.env.GOOGLE_MAIL_CLIENT_SECRET = "google-secret";
process.env.MICROSOFT_MAIL_CLIENT_ID = "ms-client";
process.env.MICROSOFT_MAIL_CLIENT_SECRET = "ms-secret";
const crypto = loadSource("lib/mailbox-crypto.ts");
const providers = loadSource("lib/mailbox-providers.ts");
const { deliverMailboxJob } = loadSource("lib/mailbox-delivery.ts");
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

test("tokens are encrypted, authenticated, and bound to the owner/provider", () => {
  const sealed = crypto.seal("refresh-secret", "owner:google");
  assert.doesNotMatch(sealed, /refresh-secret/);
  assert.equal(crypto.unseal(sealed, "owner:google"), "refresh-secret");
  assert.throws(() => crypto.unseal(sealed, "other:google"));
  assert.throws(() => crypto.unseal(sealed.slice(0,-5) + "AAAAA", "owner:google"));
  assert.notEqual(sealed, crypto.seal("refresh-secret", "owner:google"));
  assert.equal(crypto.sameSecret("a", "b"), false);
});
test("both providers use PKCE, exact server callbacks and send-only mailbox scopes", () => {
  for (const provider of ["google", "microsoft"]) {
    const url = new URL(providers.authorizationUrl(provider, "state", "verifier"));
    assert.equal(url.searchParams.get("redirect_uri"), `https://bizcard.example/api/mailbox/callback/${provider}`);
    assert.equal(url.searchParams.get("code_challenge"), crypto.digest("verifier"));
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.doesNotMatch(url.searchParams.get("scope"), /gmail.modify|mail.google.com|Mail.Read/i);
  }
  assert.equal(providers.hasSendScope("google", "openid email"), false);
  assert.equal(providers.hasSendScope("microsoft", "User.Read Mail.Send"), true);
});
test("MIME rejects header injection and preserves Unicode body/subject", () => {
  for (const msg of [["bad\r\nBcc: x@example.com", "to@example.com", "hi"], ["from@example.com", "to@example.com", "hi\r\nBcc: other@example.com"]]) {
    assert.throws(() => providers.gmailMessage(...msg, "text"));
  }
  const mime = Buffer.from(providers.gmailMessage("from@example.com", "to@example.com", "Hello ✨", "Café\n你好"), "base64url").toString();
  assert.match(mime, /Content-Transfer-Encoding: base64/);
  assert.equal(Buffer.from(mime.split("\r\n\r\n")[1].replaceAll("\r\n", ""), "base64").toString(), "Café\n你好");
});
test("provider sending uses Gmail raw MIME and Graph 202 without requiring a JSON body", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({url, init});
    return url.includes("googleapis") ? Response.json({id:"gmail-message"}) : new Response(null, {status:202});
  };
  const message = {from:"me@example.com", to:"you@example.com", subject:"Hello", text:"Body"};
  assert.equal(await providers.sendMailboxMessage("google", "token", message), "gmail-message");
  assert.equal(await providers.sendMailboxMessage("microsoft", "token", message), null);
  assert.equal(JSON.parse(calls[1].init.body).saveToSentItems, true);
  assert.equal(JSON.parse(calls[1].init.body).message.toRecipients[0].emailAddress.address, message.to);
  assert.equal(calls[1].url, "https://graph.microsoft.com/v1.0/me/sendMail");
  globalThis.fetch = async () => Response.json({error:{errors:[{reason:"rateLimitExceeded"}]}},{status:403});
  await assert.rejects(providers.sendMailboxMessage("google", "token", message), e => !e.reconnect);
  globalThis.fetch = async () => Response.json({error:{errors:[{reason:"insufficientPermissions"}]}},{status:403});
  await assert.rejects(providers.sendMailboxMessage("google", "token", message), e => e.reconnect);
  globalThis.fetch = originalFetch;
});
test("refresh requests preserve rotation and sanitize revoked credentials", async () => {
  globalThis.fetch = async (_url, init) => {
    const body = new URLSearchParams(init.body);
    assert.equal(body.get("grant_type"), "refresh_token");
    assert.equal(body.get("refresh_token"), "old-token");
    return Response.json({access_token:"access", refresh_token:"rotated"});
  };
  assert.equal((await providers.refreshMailboxToken("microsoft", "old-token")).refresh_token, "rotated");
  globalThis.fetch = async () => Response.json({error:"invalid_grant", error_description:"secret details"}, {status:400});
  await assert.rejects(providers.refreshMailboxToken("google", "old-token"), e => e.reconnect && !e.message.includes("secret"));
  globalThis.fetch = originalFetch;
});
test("delivery suppresses stale senders, paused accounts and ambiguous retries", async () => {
  const mailbox = {id:"mail", profile_id:"profile", provider:"google", status:"connected", email:"owner@example.com"};
  const job = {id:"job", profile_id:"profile", mailbox_id:"mail", delivery_provider:"google", recipient_email:"to@example.com", subject_snapshot:"Hi", body_snapshot:"Hello"};
  let sends = 0;
  const deps = {load:async()=>({enabled:true, mailbox}), refresh:async()=>"access", stillConnected:async()=>true, send:async()=>{sends++;return "id";}, reconnect:async()=>{}};
  assert.equal((await deliverMailboxJob(job,deps)).status,"sent");
  for (const change of [{load:async()=>({enabled:false,mailbox})}, {load:async()=>({enabled:true,mailbox:null})}, {load:async()=>({enabled:true,mailbox:{...mailbox,id:"other"}})}, {stillConnected:async()=>false}]) {
    assert.equal((await deliverMailboxJob(job,{...deps,...change})).status,"cancelled");
  }
  assert.equal(sends,1);
  let attempts = 0;
  const result = await deliverMailboxJob(job,{...deps, send:async()=>{attempts++;throw new Error("provider token secret");}});
  assert.equal(attempts,1); assert.equal(result.status,"failed"); assert.match(result.error,/Sent folder/); assert.doesNotMatch(result.error,/secret/);
});

test("real SQL: OAuth ownership, one-use browser handoff, confirmation and disconnect", async () => {
  const db = await database();
  try {
    const user=randomUUID(), other=randomUUID(), profile=randomUUID(), otherProfile=randomUUID();
    await db.query("insert into auth.users values ($1),($2)",[user,other]);
    await db.query("insert into profiles(id,user_id,slug,full_name,email) values ($1,$2,'owner','Owner','owner@example.com'),($3,$4,'other','Other','other@example.com')",[profile,user,otherProfile,other]);
    const admin=adminFor(db,{owner:{id:user},other:{id:other}});
    const mocks={[adminPath]:{getSupabaseAdmin:()=>admin}};
    const start=loadSource("app/api/mailbox/connect/route.ts",mocks).POST;
    const launch=loadSource("app/api/mailbox/launch/route.ts",mocks).GET;
    const callback=loadSource("app/api/mailbox/callback/[provider]/route.ts",mocks).GET;
    const confirm=loadSource("app/api/mailbox/confirm/route.ts",mocks).POST;
    const status=loadSource("app/api/mailbox/route.ts",mocks);
    const request=(path,body,token="owner",method="POST")=>new Request(`https://bizcard.example/api/mailbox${path}`,{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
    assert.equal((await start(request("/connect",{provider:"google",platform:"web"},"fake"))).status,401);
    assert.equal((await start(request("/connect",{provider:"evil",platform:"web"}))).status,400);
    const begin=await start(request("/connect",{provider:"google",platform:"web",profile_id:otherProfile}));
    assert.equal(begin.status,200);
    const {url}=await begin.json();
    const hop=await launch(new Request(url));
    assert.equal(hop.status,307);
    assert.equal((await launch(new Request(url))).status,400);
    const authUrl=new URL(hop.headers.get("location"));
    const cookie=hop.headers.get("set-cookie").split(";")[0];
    const callbackUrl=`https://bizcard.example/api/mailbox/callback/google?state=${authUrl.searchParams.get("state")}&code=provider-code`;
    let exchanges=0;
    globalThis.fetch=async (url,init)=>{
      if (url.includes("/token")) {exchanges++; assert.equal(new URLSearchParams(init.body).get("code_verifier").length,43);return Response.json({access_token:"access-secret",refresh_token:"refresh-secret",scope:"openid email https://www.googleapis.com/auth/gmail.send"});}
      return Response.json({email:"sender@gmail.com",email_verified:true});
    };
    const noCookie=await callback(new NextRequest(callbackUrl),{params:Promise.resolve({provider:"google"})});
    assert.match(noCookie.headers.get("location"),/mailbox=error/); assert.equal(exchanges,0);
    const accepted=await callback(new NextRequest(callbackUrl,{headers:{cookie}}),{params:Promise.resolve({provider:"google"})});
    const location=accepted.headers.get("location");
    assert.doesNotMatch(location,/access-secret|refresh-secret|provider-code/);
    const receipt=new URL(location).searchParams.get("receipt"); assert.ok(receipt);
    assert.equal((await db.query("select * from mailboxes")).rows.length,0,"callback cannot attach account on its own");
    assert.equal((await confirm(request("/confirm",{receipt},"other"))).status,409,"other owner cannot redeem receipt");
    assert.equal((await confirm(request("/confirm",{receipt}))).status,200);
    assert.equal((await confirm(request("/confirm",{receipt}))).status,200,"duplicate native callbacks are idempotent");
    const mailbox=(await db.query("select * from mailboxes")).rows[0];
    assert.equal(mailbox.profile_id,profile); assert.equal(mailbox.email,"sender@gmail.com"); assert.doesNotMatch(mailbox.refresh_token_encrypted,/refresh-secret/);
    const publicStatus=await status.GET(request("",undefined,"owner","GET"));
    assert.doesNotMatch(await publicStatus.text(),/refresh_token|refresh-secret/);
    assert.equal((await start(request("/connect",{provider:"microsoft",platform:"mobile"}))).status,409,"must disconnect before changing sender");
    assert.equal((await status.DELETE(request("",undefined,"owner","DELETE"))).status,200);
    assert.equal((await db.query("select * from mailboxes")).rows.length,0);
    // Cancelled/expired flows cannot attach anything, and never call the token endpoint.
    const cancelledStart=await start(request("/connect",{provider:"microsoft",platform:"mobile"}));
    const cancelledHop=await launch(new Request((await cancelledStart.json()).url));
    const cancelState=new URL(cancelledHop.headers.get("location")).searchParams.get("state");
    const cancelled=await callback(new NextRequest(`https://bizcard.example/api/mailbox/callback/microsoft?state=${cancelState}&error=access_denied`,{headers:{cookie:cancelledHop.headers.get("set-cookie").split(";")[0]}}),{params:Promise.resolve({provider:"microsoft"})});
    assert.match(cancelled.headers.get("location"),/^bizcard:\/\/email-connected\?mailbox=cancelled$/);
    const expiredStart=await start(request("/connect",{provider:"google",platform:"web"}));
    await db.exec("update mailbox_oauth_states set expires_at=now()-interval '1 minute'");
    assert.equal((await launch(new Request((await expiredStart.json()).url))).status,400);
    assert.equal((await db.query("select * from mailboxes")).rows.length,0);
    // Disconnect while the browser has a pending receipt invalidates finalization.
    const pendingStart=await start(request("/connect",{provider:"google",platform:"web"}));
    const pendingHop=await launch(new Request((await pendingStart.json()).url));
    const pendingState=new URL(pendingHop.headers.get("location")).searchParams.get("state");
    const pendingCallback=await callback(new NextRequest(`https://bizcard.example/api/mailbox/callback/google?state=${pendingState}&code=provider-code`,{headers:{cookie:pendingHop.headers.get("set-cookie").split(";")[0]}}),{params:Promise.resolve({provider:"google"})});
    const pendingReceipt=new URL(pendingCallback.headers.get("location")).searchParams.get("receipt");
    await status.DELETE(request("",undefined,"owner","DELETE"));
    assert.equal((await confirm(request("/confirm",{receipt:pendingReceipt}))).status,409);
    // Neither anonymous nor authenticated users may read credentials or invoke privileged RPCs.
    for (const role of ["anon","authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from mailboxes"),/permission denied/);
      await assert.rejects(db.query("select * from mailbox_oauth_states"),/permission denied/);
      await assert.rejects(db.query("select * from claim_mailbox_followups(1)"),/permission denied/);
      await assert.rejects(db.query("select disconnect_mailbox($1)",[profile]),/permission denied/);
      await db.exec("reset role");
    }
  } finally {globalThis.fetch=originalFetch;await db.close();}
});

test("real SQL: queue excludes legacy/future jobs, serializes mailbox sends and cancels on disconnect", async () => {
  const db=await database();
  try {
    const profile=randomUUID();
    await db.query("insert into profiles(id,slug,full_name,email) values ($1,'owner','Owner','owner@example.com')",[profile]);
    const mailbox=randomUUID();
    await db.query("insert into mailboxes(profile_id,id,provider,email,refresh_token_encrypted) values ($1,$2,'google','sender@gmail.com','sealed')",[profile,mailbox]);
    async function job(provider,offset=0) {
      const c=randomUUID(),id=randomUUID();
      await db.query("insert into connections(id,profile_id,first_name,email,consent_at) values ($1,$2,'Recipient','to@example.com',now())",[c,profile]);
      await db.query("insert into followups(id,connection_id,profile_id,recipient_email,send_at,subject_snapshot,body_snapshot,delivery_provider,mailbox_id) values ($1,$2,$3,'to@example.com',now()+$4*interval '1 hour','Hi','Body',$5,$6)",[id,c,profile,offset,provider,mailbox]);
      return id;
    }
    const legacy=await job("resend"), future=await job("google",2), first=await job("google",-2), next=await job("google",-1);
    let claimed=await db.query("select * from claim_mailbox_followups(20)");
    assert.deepEqual(claimed.rows.map(r=>r.id),[first]);
    assert.equal((await db.query("select * from claim_mailbox_followups(20)")).rows.length,0);
    await db.query("update followups set status='sent' where id=$1",[first]);
    claimed=await db.query("select * from claim_mailbox_followups(20)");assert.deepEqual(claimed.rows.map(r=>r.id),[next]);
    await db.query("update followups set updated_at=now()-interval '20 minutes' where id=$1",[next]);
    assert.equal((await db.query("select * from claim_mailbox_followups(20)")).rows.length,0);
    assert.equal((await db.query("select status from followups where id=$1",[next])).rows[0].status,"failed");
    await db.query("select disconnect_mailbox($1)",[profile]);
    const statuses=Object.fromEntries((await db.query("select id,status from followups")).rows.map(r=>[r.id,r.status]));
    assert.equal(statuses[legacy],"scheduled"); assert.equal(statuses[future],"cancelled");
    assert.equal(statuses[first],"sent"); assert.equal(statuses[next],"failed");
  } finally {await db.close();}
});

test("real SQL: scheduler authentication, refresh rotation, accepted send, and revoked permission", async () => {
  const db=await database();
  process.env.CRON_SECRET="scheduler-secret";
  try {
    const profile=randomUUID(), mailbox=randomUUID();
    await db.query("insert into profiles(id,slug,full_name,email) values ($1,'worker','Worker','worker@example.com')",[profile]);
    await db.query("insert into mailboxes(profile_id,id,provider,email,refresh_token_encrypted) values ($1,$2,'microsoft','worker@outlook.com',$3)",[profile,mailbox,crypto.seal("old-refresh",`${profile}:microsoft`)]);
    async function enqueue() {
      const id=randomUUID(),c=randomUUID();
      await db.query("insert into connections(id,profile_id,first_name,email,consent_at) values ($1,$2,'Test','to@example.com',now())",[c,profile]);
      await db.query("insert into followups(id,connection_id,profile_id,recipient_email,send_at,subject_snapshot,body_snapshot,delivery_provider,mailbox_id) values ($1,$2,$3,'to@example.com',now()-interval '1 minute','Hi','Body','microsoft',$4)",[id,c,profile,mailbox]);
      return id;
    }
    const admin=adminFor(db);
    const worker=loadSource("app/api/jobs/followups/route.ts",{[adminPath]:{getSupabaseAdmin:()=>admin}}).GET;
    const request=secret=>new Request("https://bizcard.example/api/jobs/followups",{headers:{Authorization:`Bearer ${secret}`}});
    const id=await enqueue();
    assert.equal((await worker(request("wrong"))).status,401);
    assert.equal((await db.query("select status from followups where id=$1",[id])).rows[0].status,"scheduled");
    const calls=[];
    globalThis.fetch=async (url,init)=>{
      calls.push(url);
      return url.includes("/token") ? Response.json({access_token:"access",refresh_token:"new-refresh"}) : new Response(null,{status:202});
    };
    const response=await worker(request("scheduler-secret"));
    assert.equal(response.status,200);assert.equal((await response.json()).sent,1);
    assert.equal((await db.query("select status from followups where id=$1",[id])).rows[0].status,"sent");
    const encrypted=(await db.query("select refresh_token_encrypted from mailboxes")).rows[0].refresh_token_encrypted;
    assert.equal(crypto.unseal(encrypted,`${profile}:microsoft`),"new-refresh");
    assert.equal(calls.length,2);
    await worker(request("scheduler-secret")); assert.equal(calls.length,2,"sent job is never retried");
    const revoked=await enqueue();
    globalThis.fetch=async ()=>Response.json({error:"invalid_grant",error_description:"secret"},{status:400});
    assert.equal((await worker(request("scheduler-secret"))).status,200);
    assert.equal((await db.query("select status from mailboxes")).rows[0].status,"reconnect");
    const failed=(await db.query("select status,error from followups where id=$1",[revoked])).rows[0];
    assert.equal(failed.status,"failed");assert.match(failed.error,/Reconnect/);assert.doesNotMatch(failed.error,/secret/);
  } finally {globalThis.fetch=originalFetch;await db.close();}
});
