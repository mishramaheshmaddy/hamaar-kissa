import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const audioStoriesTable = pgTable("audio_stories", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  categoryId: integer("category_id"),
  narrator: text("narrator").notNull().default(""),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  description: text("description").notNull().default(""),
  thumbnailUrl: text("thumbnail_url"),
  audioUrl: text("audio_url").notNull(),
  sourceType: text("source_type").notNull().default("url"),
  searchTags: text("search_tags").notNull().default(""),
  published: boolean("published").notNull().default(false),
  homeSectionId: integer("home_section_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAudioStorySchema = createInsertSchema(audioStoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAudioStory = z.infer<typeof insertAudioStorySchema>;
export type AudioStory = typeof audioStoriesTable.$inferSelect;
