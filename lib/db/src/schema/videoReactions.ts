import {
  pgTable,
  serial,
  integer,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const videoReactionsTable = pgTable(
  "video_reactions",
  {
    id: serial("id").primaryKey(),

    userId: integer("user_id").notNull(),

    videoId: integer("video_id").notNull(),

    liked: boolean("liked").notNull().default(false),

    saved: boolean("saved").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("video_reactions_user_video_unique").on(
      table.userId,
      table.videoId,
    ),
  ],
);

export const insertVideoReactionSchema = createInsertSchema(
  videoReactionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVideoReaction = z.infer<
  typeof insertVideoReactionSchema
>;

export type VideoReaction =
  typeof videoReactionsTable.$inferSelect;
