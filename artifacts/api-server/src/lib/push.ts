import { db, pushTokensTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "./logger";

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
