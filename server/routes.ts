import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import multer from "multer";
import { insertDocumentSchema, insertAppointmentSchema, setupTotpSchema, verifyTotpSchema } from "@shared/schema";
import { generateTotpSecret, verifyTotp, generateQrCodeUrl } from "./totp";
import OpenAI from "openai";
import { log } from "./vite";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

const upload = multer({ dest: "uploads/" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

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

      // Create document with pending OCR status
      const doc = await storage.createDocument(req.user!.id, {
        ...docData,
        ocrStatus: 'pending',
        ocrError: null,
      });

      res.status(201).json(doc);
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Failed to upload document' 
      });
    }
  });

  // Process OCR endpoint
  app.post("/api/documents/:id/process-ocr", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const documentId = parseInt(req.params.id);
      const doc = await storage.getDocument(documentId);

      if (!doc || doc.userId !== req.user!.id) {
        return res.status(404).json({ message: "Document not found" });
      }

      log(`Starting OCR processing for document ${documentId}`);

      // Update status to processing
      await storage.updateDocument(doc.id, {
        ocrStatus: 'processing',
        ocrError: null,
      });

      try {
        // Initialize worker
        const worker = await createWorker();

        // Process image with tesseract
        const result = await worker.recognize(doc.fileUrl);
        await worker.terminate();

        if (!result.data.text || result.data.text.trim() === '') {
          throw new Error('No text could be extracted from document');
        }

        log(`OCR completed for document ${doc.id}, extracted ${result.data.text.length} characters`);

        // Update document with OCR results
        const updated = await storage.updateDocument(doc.id, {
          ocrText: result.data.text,
          ocrStatus: 'completed',
          ocrError: null,
        });

        res.json(updated);
      } catch (ocrError) {
        log(`OCR Error for document ${doc.id}: ${ocrError.message}`);
        const error = ocrError instanceof Error ? ocrError.message : 'Failed to process document';

        await storage.updateDocument(doc.id, {
          ocrStatus: 'error',
          ocrError: error,
        });

        res.status(500).json({ message: error });
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to process document' 
      });
    }
  });

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


  app.get("/api/documents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { query, category, tags, startDate, endDate } = req.query;
      console.log('Document search request:', { query, category, tags, startDate, endDate });

      const docs = await storage.getUserDocuments(req.user!.id);

      // Apply filters
      let filteredDocs = docs;

      if (query) {
        const searchQuery = (query as string).toLowerCase();
        console.log('Applying text search:', searchQuery);
        filteredDocs = filteredDocs.filter(doc => 
          doc.name.toLowerCase().includes(searchQuery) ||
          (doc.ocrText && doc.ocrText.toLowerCase().includes(searchQuery))
        );
      }

      if (category) {
        console.log('Applying category filter:', category);
        filteredDocs = filteredDocs.filter(doc => 
          doc.category === category
        );
      }

      if (tags) {
        const searchTags = JSON.parse(tags as string);
        console.log('Applying tag filters:', searchTags);
        filteredDocs = filteredDocs.filter(doc =>
          searchTags.every((tag: string) => doc.tags.includes(tag))
        );
      }

      if (startDate) {
        const start = new Date(startDate as string);
        console.log('Applying start date filter:', start);
        filteredDocs = filteredDocs.filter(doc =>
          new Date(doc.uploadedAt) >= start
        );
      }

      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        console.log('Applying end date filter:', end);
        filteredDocs = filteredDocs.filter(doc =>
          new Date(doc.uploadedAt) <= end
        );
      }

      console.log(`Found ${filteredDocs.length} documents after applying filters`);
      res.json(filteredDocs);
    } catch (error) {
      console.error('Document search error:', error);
      res.status(500).json({ message: 'Failed to search documents' });
    }
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

  // Add this endpoint after the existing document routes
  app.post("/api/documents/:id/summarize", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);

      if (!document || document.userId !== req.user!.id) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!document.ocrText) {
        return res.status(400).json({ message: "No OCR text available for summarization" });
      }

      await storage.updateDocument(documentId, {
        summaryStatus: "processing",
        summaryError: null,
      });

      const prompt = `Please summarize the following medical document text, focusing on key medical information, dates, and important details:\n\n${document.ocrText}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a medical document summarizer. Focus on extracting key medical information, dates, diagnoses, medications, and important details from medical documents."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const summary = completion.choices[0]?.message?.content;

      if (!summary) {
        throw new Error("Failed to generate summary");
      }

      const updated = await storage.updateDocument(documentId, {
        summary,
        summaryStatus: "completed",
        summaryError: null,
      });

      res.json(updated);
    } catch (error) {
      console.error('Document summarization error:', error);

      await storage.updateDocument(parseInt(req.params.id), {
        summaryStatus: "error",
        summaryError: error instanceof Error ? error.message : "Unknown error occurred",
      });

      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to summarize document" 
      });
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