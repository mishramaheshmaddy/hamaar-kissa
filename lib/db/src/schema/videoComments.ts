import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const videoCommentsTable = pgTable(
  "video_comments",
  {
    id: serial("id").primaryKey(),

    videoId: integer("video_id").notNull(),

    userId: integer("user_id").notNull(),

    text: text("text").notNull(),

    // Null = top-level comment.
    // A value points to another comment and makes this comment a reply.
    // This supports unlimited reply depth.
    parentCommentId: integer("parent_comment_id"),

    status: text("status").notNull().default("active"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("video_comments_video_idx").on(table.videoId),
    index("video_comments_user_idx").on(table.userId),
  ],
);

export const insertVideoCommentSchema = createInsertSchema(
  videoCommentsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVideoComment = z.infer<
  typeof insertVideoCommentSchema
>;

export type VideoComment =
  typeof videoCommentsTable.$inferSelect;
