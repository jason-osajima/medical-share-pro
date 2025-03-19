import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import multer from "multer";
import { insertDocumentSchema, insertAppointmentSchema, setupTotpSchema, verifyTotpSchema } from "@shared/schema";
import { generateTotpSecret, verifyTotp, generateQrCodeUrl } from "./totp";

const upload = multer({ dest: "uploads/" });

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // 2FA Routes
  app.post("/api/2fa/setup", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = await storage.getUser(req.user!.id);
    if (!user) return res.sendStatus(404);

    if (user.totpEnabled) {
      return res.status(400).json({ message: "2FA is already enabled" });
    }

    const secret = generateTotpSecret();
    const qrCodeUrl = await generateQrCodeUrl(secret);

    await storage.updateUser(user.id, {
      totpSecret: secret.base32,
      totpEnabled: false,
      totpVerified: false,
    });

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
    });
  });

  app.post("/api/2fa/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const data = verifyTotpSchema.parse(req.body);
    const user = await storage.getUser(req.user!.id);

    if (!user || !user.totpSecret) {
      return res.status(400).json({ message: "2FA not set up" });
    }

    if (verifyTotp(user.totpSecret, data.token)) {
      await storage.updateUser(user.id, {
        totpEnabled: true,
        totpVerified: true,
      });
      res.json({ success: true });
    } else {
      res.status(400).json({ message: "Invalid token" });
    }
  });

  // Add this endpoint after the existing 2FA endpoints
  app.post("/api/2fa/login-verify", async (req, res) => {
    const { token, userId } = req.body;

    const user = await storage.getUser(userId);
    if (!user || !user.totpSecret) {
      return res.status(400).json({ message: "Invalid user or 2FA not set up" });
    }

    if (verifyTotp(user.totpSecret, token)) {
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.json(user);
      });
    } else {
      res.status(400).json({ message: "Invalid verification code" });
    }
  });

  // Document upload route with improved OCR handling
  app.post("/api/documents", upload.single("file"), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.file) return res.status(400).send("No file uploaded");

    try {
      const tags = JSON.parse(req.body.tags);
      const docData = insertDocumentSchema.parse({
        ...req.body,
        tags,
        fileUrl: req.file.path,
      });

      // Create document with OCR text if provided
      const doc = await storage.createDocument(req.user!.id, {
        ...docData,
        ocrText: req.body.ocrText || null,
        ocrStatus: req.body.ocrText ? 'completed' : 'pending',
        ocrError: null, // Reset any previous error
      });

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

  // Generate share link for a document
  app.post("/api/documents/:id/share", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const documentId = parseInt(req.params.id);
      const doc = await storage.getDocument(documentId);

      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ message: "Document not found" });
      }

      const shareLink = await storage.createShareLink(documentId, req.body);
      res.status(201).json({
        ...shareLink,
        url: `${req.protocol}://${req.get('host')}/shared/${shareLink.token}`,
      });
    } catch (error) {
      console.error('Share link creation error:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Failed to create share link' 
      });
    }
  });

  // Get all share links for a document
  app.get("/api/documents/:id/share", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const documentId = parseInt(req.params.id);
      const doc = await storage.getDocument(documentId);

      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ message: "Document not found" });
      }

      const links = await storage.getDocumentShareLinks(documentId);
      const shareLinks = links.map(link => ({
        ...link,
        url: `${req.protocol}://${req.get('host')}/shared/${link.token}`,
      }));

      res.json(shareLinks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch share links" });
    }
  });

  // Access shared document
  app.get("/api/shared/:token", async (req, res) => {
    try {
      const doc = await storage.getSharedDocument(req.params.token);
      if (!doc) {
        return res.status(404).json({ message: "Document not found or link expired" });
      }
      res.json(doc);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shared document" });
    }
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