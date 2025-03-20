import { IStorage } from "./types";
import { db } from "./db";
import { users, documents, appointments, shareLinks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { User, Document, Appointment, InsertUser, InsertDocument, InsertAppointment, ShareLink, InsertShareLink } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { randomBytes } from "crypto";

const PostgresSessionStore = connectPg(session);

// Add updateDocument method to IStorage interface
export interface IStorage {
  sessionStore: session.SessionStore;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUser(id: number, updateData: Partial<User>): Promise<User>;
  createDocument(userId: number, doc: InsertDocument): Promise<Document>;
  getDocument(id: number): Promise<Document | undefined>;
  getUserDocuments(userId: number): Promise<Document[]>;
  createAppointment(userId: number, appt: InsertAppointment): Promise<Appointment>;
  getUserAppointments(userId: number): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  updateAppointment(id: number, appt: Partial<InsertAppointment>): Promise<Appointment>;
  deleteAppointment(id: number): Promise<void>;
  createShareLink(documentId: number, options: InsertShareLink): Promise<ShareLink>;
  getShareLink(token: string): Promise<ShareLink | undefined>;
  incrementShareLinkAccess(id: number): Promise<void>;
  getSharedDocument(token: string): Promise<Document | undefined>;
  getDocumentShareLinks(documentId: number): Promise<ShareLink[]>;
  updateDocument(id: number, updateData: Partial<Document>): Promise<Document>;
}

// Add implementation in DatabaseStorage class
export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updateData: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async createDocument(userId: number, doc: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values({ ...doc, userId })
      .returning();
    return document;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return document;
  }

  async getUserDocuments(userId: number): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.userId, userId));
  }

  async createAppointment(userId: number, appt: InsertAppointment): Promise<Appointment> {
    const [appointment] = await db
      .insert(appointments)
      .values({ ...appt, userId })
      .returning();
    return appointment;
  }

  async getUserAppointments(userId: number): Promise<Appointment[]> {
    return db.select().from(appointments).where(eq(appointments.userId, userId));
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id));
    return appointment;
  }

  async updateAppointment(id: number, appt: Partial<InsertAppointment>): Promise<Appointment> {
    const [updated] = await db
      .update(appointments)
      .set(appt)
      .where(eq(appointments.id, id))
      .returning();
    if (!updated) throw new Error("Appointment not found");
    return updated;
  }

  async deleteAppointment(id: number): Promise<void> {
    await db.delete(appointments).where(eq(appointments.id, id));
  }

  async createShareLink(documentId: number, options: InsertShareLink): Promise<ShareLink> {
    const token = randomBytes(32).toString('hex');

    const [shareLink] = await db
      .insert(shareLinks)
      .values({
        documentId,
        token,
        expiresAt: options.expiresInDays
          ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
          : null,
        maxAccesses: options.maxAccesses,
      })
      .returning();

    return shareLink;
  }

  async getShareLink(token: string): Promise<ShareLink | undefined> {
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.token, token));

    return link;
  }

  async incrementShareLinkAccess(id: number): Promise<void> {
    await db
      .update(shareLinks)
      .set({ accessCount: db.raw('access_count + 1') })
      .where(eq(shareLinks.id, id));
  }

  async getSharedDocument(token: string): Promise<Document | undefined> {
    const [result] = await db
      .select({
        document: documents,
        shareLink: shareLinks,
      })
      .from(documents)
      .innerJoin(shareLinks, eq(documents.id, shareLinks.documentId))
      .where(eq(shareLinks.token, token));

    if (!result) return undefined;

    const { document, shareLink } = result;

    // Check if link has expired
    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      return undefined;
    }

    // Check if max accesses reached
    if (shareLink.maxAccesses && shareLink.accessCount >= shareLink.maxAccesses) {
      return undefined;
    }

    await this.incrementShareLinkAccess(shareLink.id);
    return document;
  }

  async getDocumentShareLinks(documentId: number): Promise<ShareLink[]> {
    return db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.documentId, documentId));
  }

  async updateDocument(id: number, updateData: Partial<Document>): Promise<Document> {
    const [document] = await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, id))
      .returning();
    if (!document) throw new Error("Document not found");
    return document;
  }
}

export const storage = new DatabaseStorage();