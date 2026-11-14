import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// ✅ Check for API Key
if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in .env file");
}

// ✅ Use API key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Multer config for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

async function startServer() {
  const app = express();
  const PORT = 8080;

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ============================
  // CV UPLOAD & RANKING ROUTE
  // ============================
  app.post(
    "/api/applications/upload",
    upload.single("resume"),
    async (req: any, res) => {
      try {
        const file = req.file;
        const { jobDescription } = req.body;

        if (!file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        console.log("📄 Processing CV:", file.originalname);

        const base64Data = file.buffer.toString("base64");
        const mimeType = file.mimetype;

        // ✅ UPDATED: Using stable gemini-1.5-flash
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { 
              responseMimeType: "application/json",
              temperature: 0.1 // Lower temperature for more consistent extraction
            }
        });

        const prompt = `
          You are an expert HR AI assistant.
          Analyze the provided resume file and compare it against the following Job Description.
          
          JOB DESCRIPTION:
          ${jobDescription || "N/A"}

          Return the data in this EXACT JSON format. Do not include markdown formatting or extra text.
          {
            "analysis": {
              "fullName": "Extract candidate name",
              "email": "Extract email",
              "skills": ["skill1", "skill2"],
              "summary": "Brief professional summary"
            },
            "scoring": {
              "score": 85,
              "summary": "Reasoning for the score",
              "strengths": ["list key strengths"],
              "weaknesses": ["list missing requirements"]
            }
          }
        `;

        const result = await model.generateContent([
          { text: prompt },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
        ]);

        const response = await result.response;
        const responseText = response.text();
        
        console.log("🤖 Gemini Ranking Result:", responseText);

        // Parse the JSON output from Gemini
        const data = JSON.parse(responseText);

        return res.json({
          ...data,
          resumeBase64: `data:${mimeType};base64,${base64Data}`,
          fileName: file.originalname,
        });

      } catch (error: any) {
        console.error("❌ Server error:", error);
        
        const errorMessage = error.response?.data?.error?.message || error.message;
        
        return res.status(500).json({
          error: "Processing failed",
          details: errorMessage,
        });
      }
    }
  );

  // ============================
  // VITE / STATIC HOSTING
  // ============================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("❌ Failed to start server:", err);
});