import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import multer from "multer";
import { insertDocumentSchema, insertAppointmentSchema } from "@shared/schema";

const upload = multer({ dest: "uploads/" });

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Documents
  app.post("/api/documents", upload.single("file"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.file) return res.status(400).send("No file uploaded");

    try {
      // Parse tags from JSON string back to array
      const tags = JSON.parse(req.body.tags);

      const docData = insertDocumentSchema.parse({
        ...req.body,
        tags,
        fileUrl: req.file.path,
      });

      const doc = await storage.createDocument(req.user!.id, docData);
      res.status(201).json(doc);
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Failed to upload document' 
      });
    }
  });

  app.get("/api/documents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const docs = await storage.getUserDocuments(req.user!.id);
    res.json(docs);
  });

  // Appointments
  app.post("/api/appointments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const apptData = insertAppointmentSchema.parse(req.body);
    const appt = await storage.createAppointment(req.user!.id, apptData);
    res.status(201).json(appt);
  });

  app.get("/api/appointments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const appts = await storage.getUserAppointments(req.user!.id);
    res.json(appts);
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const appt = await storage.getAppointment(Number(req.params.id));
    if (!appt || appt.userId !== req.user!.id) {
      return res.sendStatus(404);
    }

    const updated = await storage.updateAppointment(
      appt.id,
      insertAppointmentSchema.partial().parse(req.body)
    );
    res.json(updated);
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const appt = await storage.getAppointment(Number(req.params.id));
    if (!appt || appt.userId !== req.user!.id) {
      return res.sendStatus(404);
    }

    await storage.deleteAppointment(appt.id);
    res.sendStatus(204);
  });

  const httpServer = createServer(app);
  return httpServer;
}