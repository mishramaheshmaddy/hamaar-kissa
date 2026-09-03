// Read-only diagnostic — prints the current state of push_tokens, most
// recently updated first, so we can see directly whether a token's phone
// is actually set correctly right now, without guessing from broadcast
// results. Safe to run any time; makes no writes.
//
//   cd artifacts/api-server
//   DATABASE_URL="..." npx tsx scripts/check-push-tokens.ts [phone]
//
// Pass a phone number (any format) to filter to tokens whose stored phone
// contains those digits. Omit it to see the 20 most recently touched
// tokens overall.

import { db, pushTokensTable } from "@workspace/db";
import { desc } from "drizzle-orm";

async function main() {
  const filterDigits = process.argv[2]?.replace(/\D/g, "");

  const rows = await db
    .select()
    .from(pushTokensTable)
    .orderBy(desc(pushTokensTable.updatedAt));

  const filtered = filterDigits
    ? rows.filter((r) => r.phone?.replace(/\D/g, "").includes(filterDigits))
    : rows.slice(0, 20);

  if (filterDigits) {
    console.log(`Tokens with phone containing "${filterDigits}": ${filtered.length}\n`);
  } else {
    console.log(`Most recently updated 20 of ${rows.length} total tokens:\n`);
  }

  for (const r of filtered) {
    console.log(
      `token=${r.token.slice(0, 16)}...  phone=${r.phone ?? "null"}  platform=${r.platform}  ` +
      `notifyStories=${r.notifyNewStories}  notifyVideos=${r.notifyNewVideos}  ` +
      `updatedAt=${r.updatedAt.toISOString()}  createdAt=${r.createdAt.toISOString()}`
    );
  }

  if (filtered.length === 0) {
    console.log("(no matching rows)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
