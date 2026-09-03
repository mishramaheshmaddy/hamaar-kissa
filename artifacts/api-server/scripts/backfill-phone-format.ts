// One-time backfill: `userAuth.ts` used to store phone numbers as raw
// 10-digit strings (e.g. "9876543210") via its own local normalizePhone,
// while the notification-targeting code in lib/push.ts has always
// expected "+91XXXXXXXXXX". That mismatch meant every CMS notification
// targeted at a specific phone number silently matched 0 devices, even
// when the person's push token was correctly registered.
//
// userAuth.ts now uses the same +91-prefixed normalizePhone as
// lib/push.ts going forward, but that only fixes NEW logins. This script
// rewrites every already-stored phone number (users + push_tokens) to
// the same format, so existing accounts don't have to log out and back
// in before notifications can reach them.
//
// Run once, against production, after deploying the normalizePhone fix:
//   cd artifacts/api-server
//   DATABASE_URL="..." npx tsx scripts/backfill-phone-format.ts

import { db, usersTable, pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { normalizePhone } from "../src/lib/push";

async function main() {
  const users = await db.select().from(usersTable);
  console.log(`Found ${users.length} users`);

  let usersFixed = 0;
  let usersSkippedAlready = 0;
  let usersSkippedInvalid = 0;

  for (const user of users) {
    if (!user.phone) continue;

    if (user.phone.startsWith("+91") && user.phone.length === 13) {
      usersSkippedAlready++;
      continue;
    }

    const normalized = normalizePhone(user.phone);
    if (!normalized) {
      console.warn(`⚠️  Could not normalize phone for user ${user.id}: "${user.phone}" — left as-is`);
      usersSkippedInvalid++;
      continue;
    }

    await db.update(usersTable).set({ phone: normalized }).where(eq(usersTable.id, user.id));
    console.log(`✓ user ${user.id}: "${user.phone}" -> "${normalized}"`);
    usersFixed++;
  }

  console.log(
    `\nUsers: ${usersFixed} fixed, ${usersSkippedAlready} already correct, ${usersSkippedInvalid} could not be normalized\n`
  );

  const tokens = await db.select().from(pushTokensTable);
  console.log(`Found ${tokens.length} push tokens`);

  let tokensFixed = 0;
  let tokensSkippedAlready = 0;
  let tokensSkippedInvalid = 0;

  for (const row of tokens) {
    if (!row.phone) continue;

    if (row.phone.startsWith("+91") && row.phone.length === 13) {
      tokensSkippedAlready++;
      continue;
    }

    const normalized = normalizePhone(row.phone);
    if (!normalized) {
      console.warn(`⚠️  Could not normalize phone for push token ${row.token.slice(0, 12)}...: "${row.phone}" — left as-is`);
      tokensSkippedInvalid++;
      continue;
    }

    await db.update(pushTokensTable).set({ phone: normalized }).where(eq(pushTokensTable.token, row.token));
    console.log(`✓ token ${row.token.slice(0, 12)}...: "${row.phone}" -> "${normalized}"`);
    tokensFixed++;
  }

  console.log(
    `\nPush tokens: ${tokensFixed} fixed, ${tokensSkippedAlready} already correct, ${tokensSkippedInvalid} could not be normalized\n`
  );

  console.log("🎉 Backfill complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
