import assert from "node:assert/strict";
import { test } from "node:test";
import { missingTestEmailSettings, testEmailConfigError } from "../lib/test-email-config.ts";
const complete = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "secret-admin",
  RESEND_API_KEY: "secret-resend",
  FOLLOWUP_FROM_EMAIL: "private-sender@example.com",
};
test("complete configuration reports no missing settings", () => {
  assert.deepEqual(missingTestEmailSettings(complete), []);
  assert.equal(testEmailConfigError(complete), null);
});
test("each absent setting is identified independently", () => {
  for (const key of Object.keys(complete)) {
    const env = { ...complete };
    delete env[key];
    const missing = missingTestEmailSettings(env);
    assert.equal(missing.length, 1);
    assert.ok(missing[0].startsWith(key));
  }
});
test("supported Supabase aliases satisfy the check", () => {
  assert.equal(testEmailConfigError({
    ...complete, NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: undefined,
    SUPABASE_URL: complete.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: complete.SUPABASE_SERVICE_ROLE_KEY,
  }), null);
});
test("missing, empty and whitespace-only values are identified", () => {
  assert.equal(missingTestEmailSettings({}).length, 4);
  for (const value of ["", " ", "\n\t"]) {
    assert.deepEqual(missingTestEmailSettings({ ...complete, RESEND_API_KEY: value }), ["RESEND_API_KEY"]);
  }
});
test("diagnostics never include values, unrelated variables, or secrets", () => {
  const message = testEmailConfigError({ ...complete, RESEND_API_KEY: "", UNRELATED_SECRET: "do-not-leak" });
  for (const value of [...Object.values(complete), "do-not-leak", "UNRELATED_SECRET"]) {
    assert.ok(!message.includes(value));
  }
  assert.match(message, /RESEND_API_KEY/);
});
