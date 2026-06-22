import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userSubmissionsTable = pgTable("user_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  audioUrl: text("audio_url").notNull(),
  fileSize: integer("file_size"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSubmissionSchema = createInsertSchema(userSubmissionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserSubmission = z.infer<typeof insertUserSubmissionSchema>;
export type UserSubmission = typeof userSubmissionsTable.$inferSelect;
