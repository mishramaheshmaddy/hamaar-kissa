import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { homeSectionsTable } from "./homeSections";

export const homeSectionItemsTable = pgTable("home_section_items", {
  id: serial("id").primaryKey(),
  homeSectionId: integer("home_section_id").notNull().references(() => homeSectionsTable.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  contentId: integer("content_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HomeSectionItem = typeof homeSectionItemsTable.$inferSelect;
