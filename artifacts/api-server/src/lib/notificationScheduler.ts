import cron from "node-cron";
import { and, eq, lte } from "drizzle-orm";
import {
  db,
  notificationSettingsTable,
  scheduledNotificationsTable,
  pushTokensTable,
} from "@workspace/db";
import { sendPushToTokens, resolveTokensForPhones } from "./push";
import { logger } from "./logger";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function buildDeepLinkData(
  contentType: string | null | undefined,
  contentId: number | null | undefined,
): Record<string, string> | undefined {
  if (!contentType || !contentId) return undefined;
  return { type: contentType, id: String(contentId) };
}

/**
 * Checks the singleton daily-cycle row: if it's enabled and either has
 * never been sent, or it's been >= 24h since the last send, fires it and
 * stamps dailyCycleLastSentAt. Using a persisted timestamp (rather than
 * an in-memory setInterval) means this survives Render restarts/redeploys
 * without resetting the 24h window or double-sending.
 */
async function runDailyCycleCheck() {
  const [settings] = await db.select().from(notificationSettingsTable).limit(1);
  if (!settings || !settings.dailyCycleEnabled) return;
  if (!settings.dailyCycleTitle.trim() || !settings.dailyCycleBody.trim()) return;

  const last = settings.dailyCycleLastSentAt;
  const due = !last || Date.now() - new Date(last).getTime() >= TWENTY_FOUR_HOURS_MS;
  if (!due) return;

  const tokens = await db.select({ token: pushTokensTable.token }).from(pushTokensTable);
  if (tokens.length > 0) {
    const result = await sendPushToTokens(
      tokens.map((t) => t.token),
      settings.dailyCycleTitle,
      settings.dailyCycleBody,
      buildDeepLinkData(settings.dailyCycleContentType, settings.dailyCycleContentId),
    );
    logger.info({ ...result }, "Daily cycle notification sent");
  }

  await db
    .update(notificationSettingsTable)
    .set({ dailyCycleLastSentAt: new Date() })
    .where(eq(notificationSettingsTable.id, settings.id));
}

/** Sends any one-time scheduled notifications whose time has come. */
async function runScheduledCheck() {
  const due = await db
    .select()
    .from(scheduledNotificationsTable)
    .where(
      and(
        eq(scheduledNotificationsTable.status, "pending"),
        lte(scheduledNotificationsTable.scheduledAt, new Date()),
      ),
    );

  for (const item of due) {
    try {
      let tokens: string[];
      if (item.targetPhones) {
        const phones: string[] = JSON.parse(item.targetPhones);
        tokens = (await resolveTokensForPhones(phones)).tokens;
      } else {
        const rows = await db.select({ token: pushTokensTable.token }).from(pushTokensTable);
        tokens = rows.map((r) => r.token);
      }
      if (tokens.length > 0) {
        await sendPushToTokens(
          tokens,
          item.title,
          item.body,
          buildDeepLinkData(item.contentType, item.contentId),
        );
      }
      await db
        .update(scheduledNotificationsTable)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(scheduledNotificationsTable.id, item.id));
    } catch (e) {
      logger.error({ err: e, id: item.id }, "Scheduled notification failed to send");
      await db
        .update(scheduledNotificationsTable)
        .set({ status: "failed" })
        .where(eq(scheduledNotificationsTable.id, item.id));
    }
  }
}

/**
 * Starts a background cron tick (every 5 minutes) that drives both the
 * daily-cycle notification and one-time scheduled sends. Call once at
 * server startup. Requires the api-server process to stay running
 * continuously — fine on Render's always-on web service plans, but note
 * this won't fire if the service is asleep/scaled to zero.
 */
export function startNotificationScheduler() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      await runDailyCycleCheck();
    } catch (e) {
      logger.error({ err: e }, "Daily cycle check failed");
    }
    try {
      await runScheduledCheck();
    } catch (e) {
      logger.error({ err: e }, "Scheduled notification check failed");
    }
  });
  logger.info("Notification scheduler started (checks every 5 minutes)");
}
