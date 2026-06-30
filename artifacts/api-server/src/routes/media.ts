import { Router } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";
import { FetchYoutubeInfoBody } from "@workspace/api-zod";
const router = Router();


function getSupabase() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(url, key);
}

const storage = multer.memoryStorage();

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


router.post("/media/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const ext = req.file.originalname.includes(".")
      ? req.file.originalname.substring(req.file.originalname.lastIndexOf("."))
      : "";

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    const supabase = getSupabase();

    let bucket = "story-thumbnails";

    if (req.file.mimetype.startsWith("audio/")) {
      bucket = "story-audio";
    } else if (req.file.mimetype.startsWith("video/")) {
      bucket = "story-videos";
    }

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filename);

    return res.json({
      url: data.publicUrl,
      filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Upload failed" });
  }
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



router.post("/media/migrate-supabase-urls", async (_req, res) => {
  try {
    const { db, audioStoriesTable, videosTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");

    const AUDIO =
      "https://ddsqgtiysfnxbltxrxxy.supabase.co/storage/v1/object/public/story-audio/";

    const THUMB =
      "https://ddsqgtiysfnxbltxrxxy.supabase.co/storage/v1/object/public/story-thumbnails/";

    let audioUpdated = 0;
    let thumbUpdated = 0;
    let videoThumbUpdated = 0;

    const stories = await db.select().from(audioStoriesTable);

    for (const story of stories) {

      const update: { audioUrl?: string; thumbnailUrl?: string } = {};

      if (
        story.audioUrl &&
        story.audioUrl.startsWith("/api/media/files/")
      ) {
        update.audioUrl = AUDIO + story.audioUrl.split("/").pop();
      }

      if (
        story.thumbnailUrl &&
        story.thumbnailUrl.startsWith("/api/media/files/")
      ) {
        update.thumbnailUrl = THUMB + story.thumbnailUrl.split("/").pop();
      }

      if (Object.keys(update).length) {

        await db
          .update(audioStoriesTable)
          .set(update)
          .where(eq(audioStoriesTable.id, story.id));

        if (update.audioUrl) audioUpdated++;
        if (update.thumbnailUrl) thumbUpdated++;
      }
    }

    const videos = await db.select().from(videosTable);

    for (const video of videos) {

      if (
        video.thumbnailUrl &&
        video.thumbnailUrl.startsWith("/api/media/files/")
      ) {

        await db
          .update(videosTable)
          .set({
            thumbnailUrl:
              THUMB + video.thumbnailUrl.split("/").pop(),
          })
          .where(eq(videosTable.id, video.id));

        videoThumbUpdated++;
      }
    }

    res.json({
      success: true,
      audioUpdated,
      thumbUpdated,
      videoThumbUpdated,
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({
      success: false,
      error: String(e),
    });
  }
});



export default router;
