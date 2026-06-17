import { Router } from "express";
import { db, categoriesTable, audioStoriesTable, videosTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router = Router();

router.get("/stats", async (_req, res) => {
  const [cats] = await db.select({ count: count() }).from(categoriesTable);
  const [audio] = await db.select({ count: count() }).from(audioStoriesTable);
  const [videos] = await db.select({ count: count() }).from(videosTable);
  const [pubAudio] = await db.select({ count: count() }).from(audioStoriesTable).where(eq(audioStoriesTable.published, true));
  const [pubVideos] = await db.select({ count: count() }).from(videosTable).where(eq(videosTable.published, true));

  res.json({
    totalCategories: cats?.count ?? 0,
    totalAudioStories: audio?.count ?? 0,
    totalVideos: videos?.count ?? 0,
    publishedAudioStories: pubAudio?.count ?? 0,
    publishedVideos: pubVideos?.count ?? 0,
  });
});

export default router;
