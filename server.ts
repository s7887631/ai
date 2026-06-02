import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Resolve ES Module pathing
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY energy variable is not defined - please configure it in AI Studio secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API Route: Check API health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", development: process.env.NODE_ENV !== "production" });
  });

  // API Route: AI Compile & Drafting
  app.post("/api/gemini/compile", async (req, res) => {
    try {
      const { promptText, docType, tone } = req.body;
      if (!promptText) {
        res.status(400).json({ error: "promptText is required" });
        return;
      }

      const client = getGeminiClient();
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText + "\n\n請根據以上引導的結構、語氣和內容，生成一份完美的行政文書內容。不要輸出前言、後記、不要寫「好，這是我為你生成的模板」，直接輸出公務文書正文本體。",
        config: {
          temperature: 0.7,
        }
      });

      res.json({
        success: true,
        compiledPrompt: promptText,
        draftText: response.text || "（無法生成草稿，請檢查背景輸入）"
      });
    } catch (err: any) {
      console.error("AI Compile Error:", err);
      res.status(500).json({ error: err.message || "Internal AI Compiler error" });
    }
  });

  // API Route: AI Summarize Meeting Transcript
  app.post("/api/gemini/summarize", async (req, res) => {
    try {
      const { transcript, title } = req.body;
      if (!transcript) {
        res.status(400).json({ error: "transcript is required" });
        return;
      }

      const client = getGeminiClient();
      const prompt = `你是一位講求效率與專業度的行政主管特助。請將以下會議語音逐字稿整理成一份條理分明、層次嚴謹的高質感「會議記錄」，請以正體中文（繁體中文）輸出，不要保留任何殘破無意義助詞，要適當修飾文句使之流暢高雅。

格式要求：
1. 會議標題：${title || "未命名會議記錄"}
2. 會議時間：${new Date().toLocaleString('zh-TW')}
3. 核心精華摘要（3-5點，最精鍊的重點）
4. 討論事項與脈絡（依逐字稿之主題分類，清晰排版）
5. 決議與後續追蹤指引（精確指定執行事宜）
6. 任何未決或待確認項目

語音逐字稿內容：
"""
${transcript}
"""`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.4,
        }
      });

      res.json({
        success: true,
        summary: response.text || "（分析失敗）"
      });
    } catch (err: any) {
      console.error("AI Summary Error:", err);
      res.status(500).json({ error: err.message || "Internal AI Summarize error" });
    }
  });

  // API Route: Proxy GitHub file uploads securely
  app.post("/api/github/upload", async (req, res) => {
    try {
      const { token, owner, repo, path: filePath, content, commitMessage } = req.body;
      if (!token || !owner || !repo || !filePath || !content) {
        res.status(400).json({ error: "Missing required GitHub repository parameters" });
        return;
      }

      const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
      const apiURL = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;

      // GitHub accepts Base64 encoded string
      const base64Content = Buffer.from(content, 'utf-8').toString('base64');

      const response = await fetch(apiURL, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "aistudio-build-applet"
        },
        body: JSON.stringify({
          message: commitMessage || `Upload administrative file: ${filePath}`,
          content: base64Content
        })
      });

      const data: any = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `GitHub error status ${response.status}`);
      }

      res.json({
        success: true,
        htmlUrl: data.content?.html_url || `https://github.com/${owner}/${repo}/blob/main/${cleanPath}`,
        commit: data.commit?.sha
      });
    } catch (err: any) {
      console.error("GitHub Proxy Upload Error:", err);
      res.status(500).json({ error: err.message || "Failed to push file to GitHub" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server runs smoothly on port ${PORT}`);
  });
}

startServer();
