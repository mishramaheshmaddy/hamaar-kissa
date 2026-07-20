import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per device. No userId/auth required — matches the existing
// notification settings screen, which works for logged-out users too.
// notifyNewStories/notifyNewVideos mirror the per-type toggles already
// shown in app/settings/notifications.tsx.
export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  platform: text("platform").notNull().default("android"),
  notifyNewStories: boolean("notify_new_stories").notNull().default(true),
  notifyNewVideos: boolean("notify_new_videos").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPushTokenSchema = createInsertSchema(pushTokensTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokensTable.$inferSelect;
