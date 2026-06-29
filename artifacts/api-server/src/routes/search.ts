import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router = Router();

router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();

  if (!q) {
    return res.json({
      audio: [],
      video: [],
    });
  }

  const keyword = `%${q}%`;

  const audio = await db.execute(sql`
    SELECT
      a.id,
      a.title,
      a.description,
      a.thumbnail_url,
      a.audio_url,
      a.duration_seconds,
      a.narrator,
      c.label AS "categoryName"
    FROM audio_stories a
    LEFT JOIN categories c
      ON c.id = a.category_id
    WHERE
      a.published = true
      AND (
        a.title ILIKE ${keyword}
        OR a.description ILIKE ${keyword}
        OR a.narrator ILIKE ${keyword}
        OR c.label ILIKE ${keyword}
      )
    ORDER BY a.id DESC
    LIMIT 50
  `);

  const video = await db.execute(sql`
    SELECT
      v.id,
      v.title,
      v.description,
      v.thumbnail_url,
      v.video_url,
      c.label AS "categoryName"
    FROM videos v
    LEFT JOIN categories c
      ON c.id = v.category_id
    WHERE
      v.published = true
      AND (
        v.title ILIKE ${keyword}
        OR v.description ILIKE ${keyword}
        OR c.label ILIKE ${keyword}
      )
    ORDER BY v.id DESC
    LIMIT 50
  `);

  res.json({
    audio: audio.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      thumbnailUrl: r.thumbnail_url,
      audioUrl: r.audio_url,
      durationSeconds: r.duration_seconds,
      narrator: r.narrator,
      categoryName: r.categoryName,
    })),
    video: video.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      thumbnailUrl: r.thumbnail_url,
      videoUrl: r.video_url,
      categoryName: r.categoryName,
    })),
  });
});

export default router;
