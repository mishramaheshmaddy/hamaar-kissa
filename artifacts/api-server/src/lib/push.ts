import { db, pushTokensTable, audioStoriesTable, videosTable, contentPublishEventsTable } from "@workspace/db";
import { inArray, isNotNull, eq, count } from "drizzle-orm";
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

/**
 * Looks up the thumbnail for a piece of attached content (audio story or
 * video), so a push notification can show it in the notification tray
 * (Android's "big picture" image) instead of just plain text.
 */
export async function resolveContentImageUrl(
  contentType: string | null | undefined,
  contentId: number | null | undefined,
): Promise<string | undefined> {
  if (!contentType || !contentId) return undefined;
  if (contentType === "audio") {
    const [row] = await db
      .select({ thumbnailUrl: audioStoriesTable.thumbnailUrl })
      .from(audioStoriesTable)
      .where(eq(audioStoriesTable.id, contentId))
      .limit(1);
    return row?.thumbnailUrl ?? undefined;
  }
  if (contentType === "video") {
    const [row] = await db
      .select({ thumbnailUrl: videosTable.thumbnailUrl })
      .from(videosTable)
      .where(eq(videosTable.id, contentId))
      .limit(1);
    return row?.thumbnailUrl ?? undefined;
  }
  return undefined;
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
  imageUrl?: string,
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
        notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
        data,
        android: {
          priority: "high",
          ...(imageUrl ? { notification: { imageUrl } } : {}),
        },
        apns: imageUrl ? { fcmOptions: { imageUrl } } : undefined,
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

/**
 * Call this exactly when a piece of content (audio story or video)
 * genuinely transitions to published=true — at creation (POST with
 * published: true) or later (PATCH flipping a draft to published). Not on
 * every edit — the caller is responsible for only invoking this on a real
 * false→true transition (or brand-new row created already published).
 *
 * Records the publish event in content_publish_events (idempotent via a
 * unique constraint on contentType+contentId — a retried/duplicate call
 * for the same content ID is a no-op), then checks whether this is the
 * 1st, 11th, 21st... genuinely-published item of this type, and if so,
 * sends the new-content push notification to eligible devices.
 *
 * contentType and contentId identify the content itself; title is used
 * only for the audio notification's exact wording (unused for video, per
 * the product spec's fixed video notification text).
 */
export async function maybeNotifyNewContent(
  contentType: "audio" | "video",
  contentId: number,
  title: string,
  thumbnailUrl: string | null | undefined,
): Promise<{ notified: boolean; sent?: number; failed?: number }> {
  try {
    const inserted = await db
      .insert(contentPublishEventsTable)
      .values({ contentType, contentId })
      .onConflictDoNothing({ target: [contentPublishEventsTable.contentType, contentPublishEventsTable.contentId] })
      .returning({ id: contentPublishEventsTable.id });

    // Already recorded before (a retry, or this content was already
    // processed) — never re-count or re-notify for the same content ID.
    if (inserted.length === 0) {
      return { notified: false };
    }

    const [{ c: publishedCount }] = await db
      .select({ c: count() })
      .from(contentPublishEventsTable)
      .where(eq(contentPublishEventsTable.contentType, contentType));

    // 1st, 11th, 21st, 31st... i.e. (count - 1) is a multiple of 10.
    const isTrigger = (publishedCount - 1) % 10 === 0;
    if (!isTrigger) {
      return { notified: false };
    }

    const prefColumn = contentType === "audio" ? pushTokensTable.notifyNewStories : pushTokensTable.notifyNewVideos;
    const eligible = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(eq(prefColumn, true));
    const tokens = eligible.map((r) => r.token);

    if (tokens.length === 0) {
      return { notified: false };
    }

    const body =
      contentType === "audio"
        ? `हमार किस्सा में आ गईल नया कहानी, ${title}, क्लिक करी आ अभीयें सुनी`
        : `हमार किस्सा में आ गईल नया Video, क्लिक करी आ अभीयें देखि`;

    const result = await sendPushToTokens(
      tokens,
      "हमार किस्सा",
      body,
      { type: contentType, id: String(contentId) },
      thumbnailUrl ?? undefined,
    );

    return { notified: true, ...result };
  } catch (e) {
    // A notification failure must never break content creation/publish
    // itself — the CMS save already succeeded by the time this runs.
    logger.error({ err: e, contentType, contentId }, "maybeNotifyNewContent failed");
    return { notified: false };
  }
}
