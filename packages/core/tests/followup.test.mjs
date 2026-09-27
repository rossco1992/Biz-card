import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { appendEmailSignature, buildEventContext, firstNameFromFullName, getConnectionFollowup, mergeTemplate } from "../src/index.ts";

for (const status of ["scheduled", "sending", "sent", "failed", "cancelled"]) {
  test(`reads ${status} from a to-one object and a legacy array`, () => {
    const followup = Object.freeze({
      status,
      send_at: "2026-09-20T01:38:00.000Z",
      sent_at: status === "sent" ? "2026-09-20T01:38:00.000Z" : null,
      error: status === "failed" ? "Delivery failed" : null,
    });
    assert.equal(getConnectionFollowup({ followups: followup }), followup);
    assert.equal(getConnectionFollowup({ followups: [followup] }), followup);
  });
}

test("missing follow-ups remain absent instead of inventing a schedule", () => {
  for (const connection of [{}, { followups: null }, { followups: undefined }, { followups: [] }]) {
    assert.equal(getConnectionFollowup(connection), undefined);
  }
});

test("both display consumers use the shared accessor", () => {
  for (const path of [
    "../../../apps/mobile/app/(tabs)/connections.tsx",
    "../../../apps/web/components/owner-dashboard.tsx",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /const followup = getConnectionFollowup\(connection\)/);
    assert.doesNotMatch(source, /connection\.followups\?\.\[0\]/);
  }
});


test("event context makes a follow-up immediately recognizable", () => {
  const values = {
    first_name: "Mike",
    my_first_name: firstNameFromFullName("Ross Cohen"),
    event_name: "SaaStr Annual 2026",
    event_location: "San Francisco, CA",
    event_context: buildEventContext("SaaStr Annual 2026", "San Francisco, CA"),
  };
  assert.equal(values.my_first_name, "Ross");
  assert.equal(values.event_context, "SaaStr Annual 2026 in San Francisco, CA");
  assert.equal(
    mergeTemplate("{{my_first_name}} from {{event_name}} — great meeting you", values),
    "Ross from SaaStr Annual 2026 — great meeting you",
  );
});

test("email signature is appended once only when the mode enables it", () => {
  assert.equal(appendEmailSignature("Hello Mike", "Ross Cohen\nKNCT", true), "Hello Mike\n\nRoss Cohen\nKNCT");
  assert.equal(appendEmailSignature("Hello Mike", "Ross Cohen\nKNCT", false), "Hello Mike");
  assert.equal(appendEmailSignature("Hello Mike", "   ", true), "Hello Mike");
});
