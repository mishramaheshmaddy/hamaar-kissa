import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const homeSectionsTable = pgTable("home_sections", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  type: text("type").notNull().default("audio"),
  contentSource: text("content_source").notNull().default("latest"),
  categoryId: integer("category_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHomeSectionSchema = createInsertSchema(homeSectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHomeSection = z.infer<typeof insertHomeSectionSchema>;
export type HomeSection = typeof homeSectionsTable.$inferSelect;
