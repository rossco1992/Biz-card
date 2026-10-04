import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadSource, adminPath } from "./mailbox-harness.mjs";

const sourcePath = path => fileURLToPath(new URL(`../${path}`, import.meta.url));

test("launch blocks Twilio even when credentials and an approved sender exist", async () => {
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "test-token";
  const twilio = loadSource("lib/twilio-sms.ts");
  assert.equal(twilio.twilioConfigured(), false);
  await assert.rejects(twilio.sendTwilioSms({ twilio_subaccount_sid: "ACsender", messaging_service_sid: "MGsender" }, "+17325550123", "Hello"), /not available in this release/);
});

test("older clients cannot request, enable, or test SMS", async () => {
  const mocks = { [adminPath]: { getSupabaseAdmin() { throw new Error("Must not access provisioning"); } } };
  const routes = loadSource("app/api/sms/route.ts", mocks);
  for (const action of ["request", "enable", "disable"]) {
    const response = await routes.POST(new Request("https://example.com/api/sms", { method: "POST", body: JSON.stringify({ action }) }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /not available in this release/);
  }
  assert.equal((await routes.GET(new Request("https://example.com/api/sms"))).status, 503);
  const testSend = loadSource("app/api/sms/test/route.ts", mocks).POST;
  assert.equal((await testSend(new Request("https://example.com/api/sms/test", { method: "POST" }))).status, 503);
});

test("worker cancels queued SMS while continuing to deliver email", async () => {
  process.env.CRON_SECRET = "test-cron";
  const updates = [];
  let emails = 0;
  const admin = {
    async rpc(name) {
      return { data: name === "claim_mailbox_followups"
        ? [{ id: "email-job", recipient_email: "recipient@example.com" }]
        : [{ id: "sms-job", recipient_phone: "+17325550123" }], error: null };
    },
    from(table) {
      assert.equal(table, "followups");
      return { update(value) {
        const entry = { value, filters: {} }; updates.push(entry);
        const query = { eq(key, value) { entry.filters[key] = value; return query; }, then(resolve) { return Promise.resolve({ error: null }).then(resolve); } };
        return query;
      } };
    },
  };
  const worker = loadSource("app/api/jobs/followups/route.ts", {
    [adminPath]: { getSupabaseAdmin: () => admin },
    [sourcePath("lib/mailbox-delivery.ts")]: { deliverMailboxJob: async () => { emails++; return { status: "sent", error: null }; } },
    [sourcePath("lib/sms-delivery.ts")]: { deliverSmsJob: async () => { throw new Error("SMS delivery must not run"); } },
  }).GET;
  const response = await worker(new Request("https://example.com/api/jobs/followups", { headers: { authorization: "Bearer test-cron" } }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(emails, 1);
  assert.equal(result.sent, 1);
  assert.equal(result.cancelled, 1);
  assert.equal(result.sms.sent, 0);
  assert.equal(updates.find(u => u.filters.id === "sms-job").value.status, "cancelled");
});

test("old public forms with SMS consent still save contacts and schedule only email", async () => {
  const inserts = [];
  const admin = {
    async rpc(name) {
      assert.ok(["consume_public_connection_rate", "consume_followup_allowance"].includes(name));
      return { data: name === "consume_followup_allowance" ? { allowed: true } : true, error: null };
    },
    from(table) {
      assert.ok(["connections", "mailboxes", "followups"].includes(table));
      let insert;
      const query = {
        insert(value) { insert = value; inserts.push({ table, value }); return query; },
        select() { return query; }, eq() { return query; }, gte() { return query; }, limit() { return query; }, single() { return query; }, maybeSingle() { return query; },
        then(resolve) {
          const data = table === "mailboxes" ? { id: "mailbox", provider: "google", status: "connected" }
            : insert ? { id: "saved", created_at: new Date().toISOString() } : [];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  const handler = loadSource("app/api/connections/route.ts", {
    [adminPath]: { getSupabaseAdmin: () => admin },
    [sourcePath("lib/profile.ts")]: { getPublicProfile: async () => ({
      id: "owner", full_name: "Owner", followup_enabled: true, sms_followup_enabled: true,
      active_mode: { id: "mode", sms_enabled: true, delay_hours: 24, subject_template: "Hello", body_template: "Nice meeting you", include_signature: false },
    }) },
  }).POST;
  const response = await handler(new Request("https://example.com/api/connections", { method: "POST", body: JSON.stringify({
    slug: "owner", first_name: "Visitor", email: "visitor@example.com", phone: "+17325550123", consent: true, sms_consent: true,
  }) }));
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.followup_status, "scheduled");
  assert.equal(result.sms_scheduled_at, null);
  assert.equal(inserts.find(i => i.table === "connections").value.sms_consent_at, null);
  assert.deepEqual(inserts.filter(i => i.table === "followups").map(i => i.value.channel), ["email"]);
});
