import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { loadSource, database } from "./mailbox-harness.mjs";

process.env.TWILIO_ACCOUNT_SID = "AC11111111111111111111111111111111";
process.env.TWILIO_AUTH_TOKEN = "twilio-secret";

const twilio = loadSource("lib/twilio-sms.ts");
const { deliverSmsJob } = loadSource("lib/sms-delivery.ts");
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

const sender = {
  profile_id: "profile",
  id: "sender",
  status: "approved",
  phone_number: "+17325550100",
  twilio_subaccount_sid: "AC22222222222222222222222222222222",
  messaging_service_sid: "MG33333333333333333333333333333333",
  phone_number_sid: null,
  brand_sid: null,
  campaign_sid: null,
  status_detail: null,
  requested_at: "2026-09-30T00:00:00Z",
  approved_at: "2026-09-30T00:00:00Z",
  updated_at: "2026-09-30T00:00:00Z",
};

test("Twilio sender posts E.164 recipient and Messaging Service to the subaccount", async () => {
  let call;
  globalThis.fetch = async (url, init) => {
    call = { url, init };
    return Response.json({ sid: "SM44444444444444444444444444444444", status: "accepted" });
  };

  const result = await twilio.sendTwilioSms(sender, "+17325550123", "Great meeting you. Reply STOP to opt out.");
  assert.equal(result.id, "SM44444444444444444444444444444444");
  assert.equal(call.url, "https://api.twilio.com/2010-04-01/Accounts/AC22222222222222222222222222222222/Messages.json");

  const params = new URLSearchParams(call.init.body);
  assert.equal(params.get("To"), "+17325550123");
  assert.equal(params.get("MessagingServiceSid"), sender.messaging_service_sid);
  assert.match(params.get("Body"), /STOP/);

  const auth = call.init.headers.Authorization;
  assert.equal(
    Buffer.from(auth.replace("Basic ", ""), "base64").toString(),
    "AC11111111111111111111111111111111:twilio-secret",
  );
  globalThis.fetch = originalFetch;
});

test("Twilio provider errors do not leak provider details into the delivery result", async () => {
  globalThis.fetch = async () => Response.json({ code: 21211, message: "secret provider detail" }, { status: 400 });
  await assert.rejects(twilio.sendTwilioSms(sender, "+17325550123", "Hello"), /secret provider detail/);

  const job = { id: "job", profile_id: "profile", recipient_phone: "+17325550123", body_snapshot: "Hello" };
  const result = await deliverSmsJob(job, {
    load: async () => ({ followupsEnabled: true, smsEnabled: true, hasSmsAccess: true, sender }),
    stillReady: async () => true,
    send: async () => twilio.sendTwilioSms(sender, job.recipient_phone, job.body_snapshot),
  });
  assert.equal(result.status, "failed");
  assert.match(result.error, /could not be confirmed/i);
  assert.doesNotMatch(result.error, /secret provider detail/);
  globalThis.fetch = originalFetch;
});

test("SMS delivery suppresses paused, non-Pro+, unapproved, and changed senders", async () => {
  const job = { id: "job", profile_id: "profile", recipient_phone: "+17325550123", body_snapshot: "Hello" };
  let sends = 0;
  const base = {
    load: async () => ({ followupsEnabled: true, smsEnabled: true, hasSmsAccess: true, sender }),
    stillReady: async () => true,
    send: async () => { sends++; return { id: "SM1" }; },
  };

  const sent = await deliverSmsJob(job, base);
  assert.equal(sent.status, "sent");
  assert.equal(sent.provider_message_id, "SM1");

  for (const override of [
    { load: async () => ({ followupsEnabled: false, smsEnabled: true, hasSmsAccess: true, sender }) },
    { load: async () => ({ followupsEnabled: true, smsEnabled: false, hasSmsAccess: true, sender }) },
    { load: async () => ({ followupsEnabled: true, smsEnabled: true, hasSmsAccess: false, sender }) },
    { load: async () => ({ followupsEnabled: true, smsEnabled: true, hasSmsAccess: true, sender: { ...sender, status: "pending" } }) },
    { stillReady: async () => false },
  ]) {
    const result = await deliverSmsJob(job, { ...base, ...override });
    assert.notEqual(result.status, "sent");
  }
  assert.equal(sends, 1);
});

test("real SQL: SMS queue serializes each owner and never auto-retries ambiguous sends", async () => {
  const db = await database();
  try {
    const profile = randomUUID();
    await db.query(
      "insert into profiles(id,slug,full_name,email,sms_followup_enabled) values ($1,'sms-owner','SMS Owner','owner@example.com',true)",
      [profile],
    );

    async function enqueue(offset) {
      const connection = randomUUID();
      const id = randomUUID();
      await db.query(
        "insert into connections(id,profile_id,first_name,email,phone,consent_at) values ($1,$2,'Recipient','to@example.com','+17325550123',now())",
        [connection, profile],
      );
      await db.query(
        "insert into followups(id,connection_id,profile_id,channel,recipient_email,recipient_phone,send_at,subject_snapshot,body_snapshot,delivery_provider) values ($1,$2,$3,'sms',null,'+17325550123',now()+$4*interval '1 hour','SMS follow-up','Body','twilio')",
        [id, connection, profile, offset],
      );
      return id;
    }

    const first = await enqueue(-2);
    const second = await enqueue(-1);
    const future = await enqueue(2);

    let claimed = await db.query("select * from claim_sms_followups(20)");
    assert.deepEqual(claimed.rows.map(row => row.id), [first]);
    assert.equal((await db.query("select * from claim_sms_followups(20)")).rows.length, 0);

    await db.query("update followups set status='sent' where id=$1", [first]);
    claimed = await db.query("select * from claim_sms_followups(20)");
    assert.deepEqual(claimed.rows.map(row => row.id), [second]);

    await db.query("update followups set updated_at=now()-interval '20 minutes' where id=$1", [second]);
    assert.equal((await db.query("select * from claim_sms_followups(20)")).rows.length, 0);

    const stale = (await db.query("select status,error from followups where id=$1", [second])).rows[0];
    assert.equal(stale.status, "failed");
    assert.match(stale.error, /Twilio delivery logs/);
    assert.equal((await db.query("select status from followups where id=$1", [future])).rows[0].status, "scheduled");

    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from sms_senders"), /permission denied/);
      await assert.rejects(db.query("select * from claim_sms_followups(1)"), /permission denied/);
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});


test("real SQL: Pro does not unlock SMS but Pro+ does", async () => {
  const db = await database();
  try {
    const user = randomUUID();
    const profile = randomUUID();
    await db.query("insert into auth.users(id) values ($1)", [user]);
    await db.query("insert into profiles(id,user_id,slug,full_name,email) values ($1,$2,'tier-test','Tier Test','tier@example.com')", [profile, user]);

    await db.query(
      "update profile_entitlements set admin_lifetime=true, sms_admin_lifetime=false where profile_id=$1",
      [profile],
    );
    assert.equal((await db.query("select profile_has_pro($1) as allowed", [profile])).rows[0].allowed, true);
    assert.equal((await db.query("select profile_has_sms($1) as allowed", [profile])).rows[0].allowed, false);

    await db.query(
      "update profile_entitlements set sms_admin_lifetime=true where profile_id=$1",
      [profile],
    );
    assert.equal((await db.query("select profile_has_sms($1) as allowed", [profile])).rows[0].allowed, true);
  } finally {
    await db.close();
  }
});
