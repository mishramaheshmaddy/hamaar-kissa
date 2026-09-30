import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

let initialized = false;

/**
 * Additive, idempotent schema setup for notification analytics.
 *
 * Hamaar Kissa currently uses Drizzle schema definitions without a checked-in
 * migration history, so these two columns are added safely at API startup.
 * Every statement is IF NOT EXISTS and can be run repeatedly.
 */
export async function ensureNotificationAnalyticsSchema(): Promise<void> {
  if (initialized) return;

  await db.execute(sql`
    ALTER TABLE "scheduled_notifications"
    ADD COLUMN IF NOT EXISTS "sent_count" integer NOT NULL DEFAULT 0
  `);

  await db.execute(sql`
    ALTER TABLE "scheduled_notifications"
    ADD COLUMN IF NOT EXISTS "failed_count" integer NOT NULL DEFAULT 0
  `);

  await db.execute(sql`
    ALTER TABLE "analytics_events"
    ADD COLUMN IF NOT EXISTS "device_id" text
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "analytics_events_notification_device_idx"
    ON "analytics_events" ("event_type", "content_type", "content_id", "device_id")
  `);

  initialized = true;
  logger.info("Notification analytics schema ready");
}
