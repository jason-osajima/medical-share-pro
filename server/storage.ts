import { IStorage } from "./types";
import { db } from "./db";
import { users, documents, appointments } from "@shared/schema";
import { eq } from "drizzle-orm";
import { User, Document, Appointment, InsertUser, InsertDocument, InsertAppointment } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

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
}

export const storage = new DatabaseStorage();