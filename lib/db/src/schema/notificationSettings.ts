import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

// Singleton table (always exactly one row) controlling the recurring
// "daily cycle" notification — a repeating announcement sent at most once
// every 24 hours while enabled, using whatever message was last saved.
export const notificationSettingsTable = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  dailyCycleEnabled: boolean("daily_cycle_enabled").notNull().default(false),
  dailyCycleTitle: text("daily_cycle_title").notNull().default(""),
  dailyCycleBody: text("daily_cycle_body").notNull().default(""),
  // Optional content this notification deep-links to when tapped.
  dailyCycleContentType: text("daily_cycle_content_type"), // "audio" | "video" | null
  dailyCycleContentId: integer("daily_cycle_content_id"),
  // Drives the 24h cadence — the scheduler checks elapsed time against
  // this rather than an in-memory timer, so it survives server restarts
  // and redeploys without resetting or double-firing.
  dailyCycleLastSentAt: timestamp("daily_cycle_last_sent_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type NotificationSettings = typeof notificationSettingsTable.$inferSelect;
