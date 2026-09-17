import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

// One row per content item that has ever genuinely transitioned to
// published=true (audio story or video) — inserted exactly once per
// content ID via ON CONFLICT DO NOTHING, which is what makes this safe
// against retries/concurrent requests: a second attempt to record the
// same (contentType, contentId) simply inserts nothing.
//
// The "1st, 11th, 21st..." notification threshold is derived by counting
// rows for a given contentType, rather than storing a separate mutable
// counter — this avoids read-modify-write race conditions entirely and
// doubles as the idempotency ledger.
export const contentPublishEventsTable = pgTable(
  "content_publish_events",
  {
    id: serial("id").primaryKey(),
    contentType: text("content_type").notNull(), // "audio" | "video"
    contentId: integer("content_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("content_publish_events_type_id_unique").on(table.contentType, table.contentId),
  ],
);

export type ContentPublishEvent = typeof contentPublishEventsTable.$inferSelect;
