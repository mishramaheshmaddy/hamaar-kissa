import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { logger } from "../lib/logger";
import { FetchYoutubeInfoBody } from "@workspace/api-zod";
const router = Router();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
      "audio/mpeg", "audio/wav", "audio/mp3", "audio/ogg", "audio/x-m4a", "audio/mp4",
      "video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    logger.warn({ mimetype: file.mimetype, originalname: file.originalname }, "Upload rejected: unsupported MIME type");
    return cb(null, true);
  },
});

router.post("/media/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  logger.info({
    mimetype: req.file.mimetype,
    filename: req.file.originalname,
    size: req.file.size,
  }, "Media upload received");

  const fileUrl = `/api/media/files/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename, size: req.file.size, mimetype: req.file.mimetype });
});

router.get("/media/files/:filename", (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.sendFile(filePath);
});

router.post("/media/youtube-info", async (req, res) => {
  const body = FetchYoutubeInfoBody.parse(req.body);
  const url = body.url;

  let youtubeId: string | null = null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      youtubeId = parsed.searchParams.get("v");
      if (!youtubeId && parsed.pathname.includes("/shorts/")) {
        youtubeId = parsed.pathname.split("/shorts/")[1]?.split("?")[0] ?? null;
      }
      if (!youtubeId && parsed.pathname.includes("/embed/")) {
        youtubeId = parsed.pathname.split("/embed/")[1]?.split("?")[0] ?? null;
      }
    } else if (parsed.hostname.includes("youtu.be")) {
      youtubeId = parsed.pathname.slice(1).split("?")[0];
    }
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (!youtubeId) {
    res.status(400).json({ error: "Could not extract YouTube video ID" });
    return;
  }

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const response = await fetch(oembedUrl);
  if (!response.ok) {
    res.status(400).json({ error: "Could not fetch YouTube metadata" });
    return;
  }

  const data = await response.json() as {
    title: string;
    thumbnail_url: string;
    author_name: string;
  };

  res.json({
    title: data.title,
    thumbnailUrl: data.thumbnail_url,
    youtubeId,
    description: "",
    duration: 0,
    authorName: data.author_name,
  });
});

export default router;
