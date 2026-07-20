import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

// One-time manual notifications — either sent immediately ("Push Now",
// recorded here with status "sent" right away) or scheduled for a future
// date/time (status "pending" until the scheduler's cron tick sends it).
// Unlike the daily cycle, these never repeat.
export const scheduledNotificationsTable = pgTable("scheduled_notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  contentType: text("content_type"), // "audio" | "video" | null
  contentId: integer("content_id"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"), // pending | sent | cancelled | failed
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ScheduledNotification = typeof scheduledNotificationsTable.$inferSelect;
