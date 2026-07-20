import { db, pushTokensTable } from "@workspace/db";
import { inArray, isNotNull } from "drizzle-orm";
import { logger } from "./logger";

// Assumes India-only phone numbers (+91), consistent with the rest of this
// app (Firebase SMS region is already restricted to India — see project
// notes on the OTP login flow). Accepts loose input from admin-typed
// numbers or a bulk-uploaded sheet: with/without +91, spaces, dashes, etc.
export function normalizePhone(raw: string): string | null {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("091")) return `+91${digits.slice(3)}`;
  return null; // not a recognizable Indian mobile number — caller reports it as unmatched
}

/**
 * Resolves a list of admin-entered phone numbers to the FCM tokens of
 * devices currently logged in as those numbers. Returns which numbers had
 * no match (not registered, or not logged into the app) so the CMS can
 * show that back to the admin.
 */
export async function resolveTokensForPhones(
  rawPhones: string[],
): Promise<{ tokens: string[]; matched: string[]; unmatched: string[] }> {
  const normalized = new Map<string, string>(); // normalized -> original input
  for (const raw of rawPhones) {
    const n = normalizePhone(raw);
    if (n) normalized.set(n, raw);
    else normalized.set(`__invalid__${raw}`, raw);
  }

  const rows = await db
    .select({ token: pushTokensTable.token, phone: pushTokensTable.phone })
    .from(pushTokensTable)
    .where(isNotNull(pushTokensTable.phone));

  const tokensByPhone = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.phone) continue;
    const list = tokensByPhone.get(row.phone) ?? [];
    list.push(row.token);
    tokensByPhone.set(row.phone, list);
  }

  const tokens: string[] = [];
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const [key, original] of normalized) {
    if (key.startsWith("__invalid__")) {
      unmatched.push(original);
      continue;
    }
    const found = tokensByPhone.get(key);
    if (found && found.length > 0) {
      tokens.push(...found);
      matched.push(original);
    } else {
      unmatched.push(original);
    }
  }

  return { tokens, matched, unmatched };
}

// Same lazy-init pattern as routes/firebaseAuth.ts — reuses the same
// FIREBASE_SERVICE_ACCOUNT credential, guarded so multiple call sites can
// safely call this without double-initializing the Firebase app.
async function getMessaging() {
  const admin = await import("firebase-admin/app");
  const messaging = await import("firebase-admin/messaging");
  if (admin.getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env["FIREBASE_SERVICE_ACCOUNT"] ?? "{}");
    admin.initializeApp({
      credential: admin.cert(serviceAccount as any),
    });
  }
  return messaging.getMessaging();
}

/**
 * Sends one push notification to a batch of FCM device tokens (chunked to
 * FCM's 500-token-per-call limit), and prunes any tokens Firebase reports
 * as dead/unregistered so the push_tokens table doesn't accumulate stale
 * rows from uninstalled apps.
 */
export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ sent: number; failed: number }> {
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const messaging = await getMessaging();
  let sent = 0;
  let failed = 0;
  const deadTokens: string[] = [];

  const CHUNK_SIZE = 500;
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    try {
      const result = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data,
        android: { priority: "high" },
      });
      sent += result.successCount;
      failed += result.failureCount;
      result.responses.forEach((r, idx) => {
        const code = r.error?.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          deadTokens.push(chunk[idx]);
        }
      });
    } catch (e) {
      logger.error({ err: e }, "sendPushToTokens: FCM chunk failed");
      failed += chunk.length;
    }
  }

  if (deadTokens.length > 0) {
    await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, deadTokens));
  }

  return { sent, failed };
}
