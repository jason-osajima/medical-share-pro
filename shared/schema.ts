import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  totpVerified: boolean("totp_verified").notNull().default(false),
});

// Document model updated with OCR fields
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  tags: text("tags").array().notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  fileUrl: text("file_url").notNull(),
  ocrText: text("ocr_text"),
  ocrStatus: text("ocr_status").default("pending"),
  ocrError: text("ocr_error"),
});

// Share Links model
export const shareLinks = pgTable("share_links", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  accessCount: integer("access_count").notNull().default(0),
  maxAccesses: integer("max_accesses"),
});

// Appointment model
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  date: timestamp("date").notNull(),
  location: text("location"),
  notes: text("notes"),
  documentIds: integer("document_ids").array(),
});

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Update document schema
export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  userId: true,
  uploadedAt: true,
  ocrText: true,
  ocrStatus: true,
  ocrError: true,
});

export const insertShareLinkSchema = createInsertSchema(shareLinks).omit({
  id: true,
  token: true,
  createdAt: true,
  accessCount: true,
}).extend({
  expiresInDays: z.number().min(1).max(30).optional(),
  maxAccesses: z.number().min(1).optional(),
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  userId: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertShareLink = z.infer<typeof insertShareLinkSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

// 2FA specific schemas
export const setupTotpSchema = z.object({
  token: z.string().min(6).max(6),
});

export const verifyTotpSchema = z.object({
  token: z.string().min(6).max(6),
});