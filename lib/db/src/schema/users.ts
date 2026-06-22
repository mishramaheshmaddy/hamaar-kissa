import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  authProvider: text("auth_provider").notNull().default("phone"),
  googleId: text("google_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const otpVerificationsTable = pgTable("otp_verifications", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  otpCode: text("otp_code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOtpVerificationSchema = createInsertSchema(otpVerificationsTable).omit({ id: true, createdAt: true });
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;
export type OtpVerification = typeof otpVerificationsTable.$inferSelect;
