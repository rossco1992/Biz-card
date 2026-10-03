import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { database } from "./mailbox-harness.mjs";

test("security migration blocks cross-profile active modes and locks down rate limiting", async () => {
  const db = await database();
  try {
    const [userA, userB, profileA, profileB, modeA, modeB] = Array.from({ length: 6 }, randomUUID);
    await db.query("insert into auth.users values ($1),($2)", [userA, userB]);
    await db.query(
      "insert into profiles(id,user_id,slug,full_name,email) values ($1,$2,'alice-sec','Alice','alice@example.com'),($3,$4,'bob-sec','Bob','bob@example.com')",
      [profileA, userA, profileB, userB],
    );
    await db.query(
      "insert into modes(id,profile_id,name,kind,subject_template,body_template) values ($1,$2,'Alice mode','everyday','Hi','Body'),($3,$4,'Bob mode','everyday','Hi','Body')",
      [modeA, profileA, modeB, profileB],
    );

    await db.query("update profiles set active_mode_id=$1 where id=$2", [modeA, profileA]);
    await assert.rejects(
      db.query("update profiles set active_mode_id=$1 where id=$2", [modeB, profileA]),
      /Active mode must belong to the same profile/,
    );

    const key = "a".repeat(64);
    assert.equal((await db.query("select consume_public_connection_rate($1,2,600) as allowed", [key])).rows[0].allowed, true);
    assert.equal((await db.query("select consume_public_connection_rate($1,2,600) as allowed", [key])).rows[0].allowed, true);
    assert.equal((await db.query("select consume_public_connection_rate($1,2,600) as allowed", [key])).rows[0].allowed, false);

    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select consume_public_connection_rate($1,2,600)", [key]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from public_connection_rate_limits"),
        /permission denied/,
      );
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});

test("security migration enforces content bounds on new writes", async () => {
  const db = await database();
  try {
    await assert.rejects(
      db.query(
        "insert into profiles(slug,full_name,company,title,email) values ('oversize',repeat('x',201),'','','owner@example.com')",
      ),
      /profiles_public_fields_size_check/,
    );
  } finally {
    await db.close();
  }
});
