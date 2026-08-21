import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

import { createInsertSchema } from "drizzle-zod";

import { z } from "zod/v4";

export const playlistsTable = pgTable("playlists", {
  id: serial("id").primaryKey(),

  userId: integer("user_id").notNull(),

  name: text("name").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPlaylistSchema = createInsertSchema(playlistsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;

export type Playlist = typeof playlistsTable.$inferSelect;


export const playlistItemsTable = pgTable("playlist_items", {
  id: serial("id").primaryKey(),

  playlistId: integer("playlist_id").notNull(),

  audioStoryId: integer("audio_story_id").notNull(),

  position: integer("position").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPlaylistItemSchema = createInsertSchema(
  playlistItemsTable
).omit({
  id: true,
  createdAt: true,
});

export type InsertPlaylistItem = z.infer<typeof insertPlaylistItemSchema>;

export type PlaylistItem = typeof playlistItemsTable.$inferSelect;
