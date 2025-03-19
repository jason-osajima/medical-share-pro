import { IStorage } from "./types";
import { User, Document, Appointment, InsertUser, InsertDocument, InsertAppointment } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private documents: Map<number, Document>;
  private appointments: Map<number, Appointment>;
  sessionStore: session.SessionStore;
  currentUserId: number;
  currentDocId: number;
  currentApptId: number;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.appointments = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    this.currentUserId = 1;
    this.currentDocId = 1;
    this.currentApptId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createDocument(userId: number, doc: InsertDocument): Promise<Document> {
    const id = this.currentDocId++;
    const document: Document = {
      ...doc,
      id,
      userId,
      uploadedAt: new Date(),
    };
    this.documents.set(id, document);
    return document;
  }

  async getUserDocuments(userId: number): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.userId === userId,
    );
  }

  async createAppointment(userId: number, appt: InsertAppointment): Promise<Appointment> {
    const id = this.currentApptId++;
    const appointment: Appointment = {
      ...appt,
      id,
      userId,
    };
    this.appointments.set(id, appointment);
    return appointment;
  }

  async getUserAppointments(userId: number): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter(
      (appt) => appt.userId === userId,
    );
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async updateAppointment(id: number, appt: Partial<InsertAppointment>): Promise<Appointment> {
    const existing = await this.getAppointment(id);
    if (!existing) throw new Error("Appointment not found");
    
    const updated = { ...existing, ...appt };
    this.appointments.set(id, updated);
    return updated;
  }

  async deleteAppointment(id: number): Promise<void> {
    this.appointments.delete(id);
  }
}

export const storage = new MemStorage();
