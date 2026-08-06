import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Generic, append-only event log used to power CMS Analytics Phase 2.
// One row per user action — story_play / video_play / download / like / save.
// Deliberately generic (contentType + contentId, not separate FKs per
// content table) so future event types don't need a schema change.
export const analyticsEventsTable = pgTable(
  "analytics_events",
  {
    id: serial("id").primaryKey(),
    // Null for guests — mobile app works without login, and the mobile
    // client fires events fire-and-forget regardless of auth state.
    userId: integer("user_id"),
    eventType: text("event_type").notNull(),
    // "story" | "video" — nullable since not every future event type will
    // necessarily be tied to a piece of content.
    contentType: text("content_type"),
    contentId: integer("content_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Analytics reads are almost always "all events of type X for content Y"
    // or "all events of type X in the last N days" — index for both.
    index("analytics_events_type_content_idx").on(table.eventType, table.contentType, table.contentId),
    index("analytics_events_created_at_idx").on(table.createdAt),
  ]
);

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
