import assert from "node:assert/strict";
import { test } from "node:test";
import { handleTestEmail } from "../lib/test-email.ts";
const modeId = "00000000-0000-0000-0000-000000000001";
const request = (body = { mode_id: modeId }, auth = true) => new Request("https://example.com/api/test-email", {
  method: "POST", headers: auth ? { Authorization: "Bearer valid" } : {},
  body: JSON.stringify(body),
});
function setup(overrides = {}) {
  const sent = [];
  return { sent, deps: {
    getUser: async () => ({ id: "owner", email: "owner@example.com", email_confirmed_at: "2026-01-01" }),
    getProfile: async id => { assert.equal(id, "owner"); return { id: "profile", full_name: "Test Owner", email: "reply@example.com" }; },
    getMode: async (profile, id) => { assert.equal(profile, "profile"); assert.equal(id, modeId); return { id, subject_template: "Hello", body_template: "Message" }; },
    render: (text, values) => text + " " + values.first_name,
    send: async (message, key) => { sent.push({ message, key }); return true; },
    ...overrides,
  }};
}
test("sends immediately only to authenticated owner, ignoring supplied recipients", async () => {
  const { deps, sent } = setup();
  assert.equal((await handleTestEmail(request({ mode_id: modeId, to: "other@example.com" }), deps)).status, 200);
  assert.equal(sent[0].message.to, "owner@example.com");
  assert.equal(sent[0].message.subject, "[Test] Hello Test");
  assert.equal(sent[0].message.text, "Message Test");
  assert.equal(sent[0].message.replyTo, "reply@example.com");
  assert.equal("scheduledAt" in sent[0].message, false);
  assert.match(sent[0].key, /^test-email\/owner\//);
});
test("rejects missing, invalid, and unverified authentication", async () => {
  const missing = setup();
  assert.equal((await handleTestEmail(request({}, false), missing.deps)).status, 401);
  for (const user of [null, { id: "owner", email: "owner@example.com" }]) {
    const { deps, sent } = setup({ getUser: async () => user });
    assert.equal((await handleTestEmail(request(), deps)).status, 401);
    assert.equal(sent.length, 0);
  }
});
test("requires valid saved mode owned by profile", async () => {
  const malformed = setup();
  assert.equal((await handleTestEmail(request({ mode_id: "bad" }), malformed.deps)).status, 400);
  for (const override of [{ getProfile: async () => null }, { getMode: async () => null }]) {
    const { deps, sent } = setup(override);
    assert.equal((await handleTestEmail(request(), deps)).status, 404);
    assert.equal(sent.length, 0);
  }
});
test("provider rejection does not claim success", async () => {
  const { deps } = setup({ send: async () => false });
  assert.equal((await handleTestEmail(request(), deps)).status, 502);
});
test("exceptions return a safe error without secrets", async () => {
  const { deps } = setup({ send: async () => { throw new Error("secret"); } });
  const response = await handleTestEmail(request(), deps);
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /secret/);
});
