import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getConnectionFollowup } from "../src/index.ts";

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
