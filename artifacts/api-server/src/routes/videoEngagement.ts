import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  videosTable,
  videoCommentsTable,
  videoReactionsTable,
} from "@workspace/db";
import { requireUserAuth, verifyUserToken } from "./userAuth";

const router = Router();

function getOptionalUserId(req: import("express").Request): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const decoded = verifyUserToken(auth.slice(7));
  return decoded?.userId ?? null;
}

async function ensureVideo(videoId: number) {
  const [video] = await db
    .select({ id: videosTable.id })
    .from(videosTable)
    .where(eq(videosTable.id, videoId))
    .limit(1);
  return video;
}

router.get("/profile/saved-videos", requireUserAuth, async (req, res) => {
  try {
    const user = (req as unknown as { user: { id: number } }).user;

    const rows = await db
      .select({
        video: videosTable,
      })
      .from(videoReactionsTable)
      .innerJoin(videosTable, eq(videoReactionsTable.videoId, videosTable.id))
      .where(
        and(
          eq(videoReactionsTable.userId, user.id),
          eq(videoReactionsTable.saved, true),
          eq(videosTable.published, true),
        ),
      )
      .orderBy(
        desc(videoReactionsTable.updatedAt),
        desc(videoReactionsTable.id),
      );

    res.json(
      rows.map(({ video }) => ({
        id: video.id,
        title: video.title,
        categoryId: video.categoryId,
        categoryName: null,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl ?? null,
        videoUrl: video.videoUrl,
        sourceType: video.sourceType,
        youtubeId: video.youtubeId ?? null,
        views: video.views,
        published: video.published,
      })),
    );
  } catch (e) {
    console.error("GET /profile/saved-videos error:", e);
    res.status(500).json({ error: "Failed to load saved videos" });
  }
});

router.get("/profile/liked-videos", requireUserAuth, async (req, res) => {
  try {
    const user = (req as unknown as { user: { id: number } }).user;

    const rows = await db
      .select({
        video: videosTable,
      })
      .from(videoReactionsTable)
      .innerJoin(videosTable, eq(videoReactionsTable.videoId, videosTable.id))
      .where(
        and(
          eq(videoReactionsTable.userId, user.id),
          eq(videoReactionsTable.liked, true),
          eq(videosTable.published, true),
        ),
      )
      .orderBy(
        desc(videoReactionsTable.updatedAt),
        desc(videoReactionsTable.id),
      );

    res.json(
      rows.map(({ video }) => ({
        id: video.id,
        title: video.title,
        categoryId: video.categoryId,
        categoryName: null,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl ?? null,
        videoUrl: video.videoUrl,
        sourceType: video.sourceType,
        youtubeId: video.youtubeId ?? null,
        views: video.views,
        published: video.published,
      })),
    );
  } catch (e) {
    console.error("GET /profile/liked-videos error:", e);
    res.status(500).json({ error: "Failed to load liked videos" });
  }
});

router.get("/videos/:id/engagement", async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId)) {
      res.status(400).json({ error: "Invalid video id" });
      return;
    }

    const video = await ensureVideo(videoId);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const userId = getOptionalUserId(req);

    const [reactions, comments] = await Promise.all([
      db
        .select({ liked: videoReactionsTable.liked, saved: videoReactionsTable.saved })
        .from(videoReactionsTable)
        .where(eq(videoReactionsTable.videoId, videoId)),
      db
        .select({
          id: videoCommentsTable.id,
          text: videoCommentsTable.text,
          parentCommentId: videoCommentsTable.parentCommentId,
          createdAt: videoCommentsTable.createdAt,
          userId: videoCommentsTable.userId,
          userName: usersTable.name,
          username: usersTable.username,
          avatarUrl: usersTable.avatarUrl,
        })
        .from(videoCommentsTable)
        .innerJoin(usersTable, eq(videoCommentsTable.userId, usersTable.id))
        .where(
          and(
            eq(videoCommentsTable.videoId, videoId),
            eq(videoCommentsTable.status, "active"),
          ),
        )
        .orderBy(desc(videoCommentsTable.createdAt), desc(videoCommentsTable.id)),
    ]);

    let liked = false;
    let saved = false;

    if (userId) {
      const [reaction] = await db
        .select({ liked: videoReactionsTable.liked, saved: videoReactionsTable.saved })
        .from(videoReactionsTable)
        .where(
          and(
            eq(videoReactionsTable.videoId, videoId),
            eq(videoReactionsTable.userId, userId),
          ),
        )
        .limit(1);
      liked = reaction?.liked ?? false;
      saved = reaction?.saved ?? false;
    }

    res.json({
      likes: reactions.filter((r) => r.liked).length,
      saves: reactions.filter((r) => r.saved).length,
      liked,
      saved,
      comments: comments.map((comment) => ({
        id: comment.id,
        text: comment.text,
        parentCommentId: comment.parentCommentId ?? null,
        userId: comment.userId,
        user: comment.userName || comment.username || "आप",
        avatarUrl: comment.avatarUrl ?? null,
        createdAt: comment.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("GET /videos/:id/engagement error:", e);
    res.status(500).json({ error: "Failed to load video engagement" });
  }
});

router.put("/videos/:id/reaction", requireUserAuth, async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId)) {
      res.status(400).json({ error: "Invalid video id" });
      return;
    }

    const video = await ensureVideo(videoId);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const user = (req as unknown as { user: { id: number } }).user;
    const { liked, saved } = req.body as { liked?: unknown; saved?: unknown };

    if (typeof liked !== "boolean" || typeof saved !== "boolean") {
      res.status(400).json({ error: "liked and saved must be boolean" });
      return;
    }

    const [row] = await db
      .insert(videoReactionsTable)
      .values({ userId: user.id, videoId, liked, saved })
      .onConflictDoUpdate({
        target: [videoReactionsTable.userId, videoReactionsTable.videoId],
        set: { liked, saved, updatedAt: new Date() },
      })
      .returning();

    const reactions = await db
      .select({ liked: videoReactionsTable.liked, saved: videoReactionsTable.saved })
      .from(videoReactionsTable)
      .where(eq(videoReactionsTable.videoId, videoId));

    res.json({
      liked: row.liked,
      saved: row.saved,
      likes: reactions.filter((r) => r.liked).length,
      saves: reactions.filter((r) => r.saved).length,
    });
  } catch (e) {
    console.error("PUT /videos/:id/reaction error:", e);
    res.status(500).json({ error: "Failed to save video reaction" });
  }
});

router.post("/videos/:id/comments", requireUserAuth, async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId)) {
      res.status(400).json({ error: "Invalid video id" });
      return;
    }

    const video = await ensureVideo(videoId);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      res.status(400).json({ error: "Comment text is required" });
      return;
    }
    if (text.length > 1000) {
      res.status(400).json({ error: "Comment is too long" });
      return;
    }

    const rawParentCommentId = req.body?.parentCommentId;

    let parentCommentId: number | null = null;

    if (
      rawParentCommentId !== undefined &&
      rawParentCommentId !== null &&
      rawParentCommentId !== ""
    ) {
      const parsedParentCommentId = Number(rawParentCommentId);

      if (!Number.isInteger(parsedParentCommentId) || parsedParentCommentId <= 0) {
        res.status(400).json({ error: "Invalid parent comment id" });
        return;
      }

      const [parentComment] = await db
        .select({
          id: videoCommentsTable.id,
          videoId: videoCommentsTable.videoId,
          status: videoCommentsTable.status,
        })
        .from(videoCommentsTable)
        .where(eq(videoCommentsTable.id, parsedParentCommentId))
        .limit(1);

      if (!parentComment) {
        res.status(404).json({ error: "Parent comment not found" });
        return;
      }

      if (parentComment.videoId !== videoId) {
        res.status(400).json({
          error: "Parent comment does not belong to this video",
        });
        return;
      }

      if (parentComment.status !== "active") {
        res.status(400).json({
          error: "Cannot reply to an inactive comment",
        });
        return;
      }

      parentCommentId = parsedParentCommentId;
    }

    const user = (req as unknown as { user: { id: number } }).user;
    const [row] = await db
      .insert(videoCommentsTable)
      .values({
        videoId,
        userId: user.id,
        text,
        parentCommentId,
      })
      .returning();

    const [created] = await db
      .select({
        id: videoCommentsTable.id,
        text: videoCommentsTable.text,
        parentCommentId: videoCommentsTable.parentCommentId,
        userId: videoCommentsTable.userId,
        user: usersTable.name,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
        createdAt: videoCommentsTable.createdAt,
      })
      .from(videoCommentsTable)
      .innerJoin(usersTable, eq(videoCommentsTable.userId, usersTable.id))
      .where(eq(videoCommentsTable.id, row.id))
      .limit(1);

    res.status(201).json({
      id: created.id,
      text: created.text,
      parentCommentId: created.parentCommentId ?? null,
      userId: created.userId,
      user: created.user || created.username || "आप",
      avatarUrl: created.avatarUrl ?? null,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("POST /videos/:id/comments error:", e);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

export default router;
