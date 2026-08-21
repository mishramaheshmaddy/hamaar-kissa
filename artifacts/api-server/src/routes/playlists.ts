import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  playlistsTable,
  playlistItemsTable,
  audioStoriesTable,
} from "@workspace/db";
import { requireUserAuth } from "./userAuth";

const router = Router();

/**
 * GET /playlists
 * Logged-in user's playlists
 */
router.get("/playlists", requireUserAuth, async (req, res) => {
  const user = (req as any).user;

  const playlists = await db
    .select()
    .from(playlistsTable)
    .where(eq(playlistsTable.userId, user.id))
    .orderBy(asc(playlistsTable.id));

  res.json(playlists);
});

/**
 * POST /playlists
 * Create a new playlist
 */
router.post("/playlists", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const name = typeof req.body?.name === "string"
    ? req.body.name.trim()
    : "";

  if (!name) {
    res.status(400).json({ error: "Playlist name is required" });
    return;
  }

  const [playlist] = await db
    .insert(playlistsTable)
    .values({
      userId: user.id,
      name,
    })
    .returning();

  res.status(201).json(playlist);
});

/**
 * GET /playlists/:id
 * Get one playlist with ALL stories in their saved order
 */
router.get("/playlists/:id", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const playlistId = Number(req.params.id);

  if (!Number.isInteger(playlistId)) {
    res.status(400).json({ error: "Invalid playlist id" });
    return;
  }

  const [playlist] = await db
    .select()
    .from(playlistsTable)
    .where(
      and(
        eq(playlistsTable.id, playlistId),
        eq(playlistsTable.userId, user.id),
      ),
    );

  if (!playlist) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }

  const items = await db
    .select({
      itemId: playlistItemsTable.id,
      position: playlistItemsTable.position,
      story: audioStoriesTable,
    })
    .from(playlistItemsTable)
    .innerJoin(
      audioStoriesTable,
      eq(playlistItemsTable.audioStoryId, audioStoriesTable.id),
    )
    .where(eq(playlistItemsTable.playlistId, playlistId))
    .orderBy(asc(playlistItemsTable.position), asc(playlistItemsTable.id));

  res.json({
    ...playlist,
    items,
  });
});

/**
 * POST /playlists/:id/items
 * Add an audio story to a playlist
 */
router.post("/playlists/:id/items", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const playlistId = Number(req.params.id);
  const audioStoryId = Number(req.body?.audioStoryId);

  if (!Number.isInteger(playlistId) || !Number.isInteger(audioStoryId)) {
    res.status(400).json({ error: "Invalid playlist or audio story id" });
    return;
  }

  const [playlist] = await db
    .select()
    .from(playlistsTable)
    .where(
      and(
        eq(playlistsTable.id, playlistId),
        eq(playlistsTable.userId, user.id),
      ),
    );

  if (!playlist) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }

  const [story] = await db
    .select()
    .from(audioStoriesTable)
    .where(eq(audioStoriesTable.id, audioStoryId));

  if (!story) {
    res.status(404).json({ error: "Audio story not found" });
    return;
  }

  const existing = await db
    .select()
    .from(playlistItemsTable)
    .where(
      and(
        eq(playlistItemsTable.playlistId, playlistId),
        eq(playlistItemsTable.audioStoryId, audioStoryId),
      ),
    );

  if (existing.length > 0) {
    res.status(409).json({ error: "Story already exists in playlist" });
    return;
  }

  const existingItems = await db
    .select()
    .from(playlistItemsTable)
    .where(eq(playlistItemsTable.playlistId, playlistId));

  const position = existingItems.length;

  const [item] = await db
    .insert(playlistItemsTable)
    .values({
      playlistId,
      audioStoryId,
      position,
    })
    .returning();

  res.status(201).json(item);
});

/**
 * DELETE /playlists/:id/items/:itemId
 * Remove a story from a playlist
 */
router.delete(
  "/playlists/:id/items/:itemId",
  requireUserAuth,
  async (req, res) => {
    const user = (req as any).user;
    const playlistId = Number(req.params.id);
    const itemId = Number(req.params.itemId);

    if (!Number.isInteger(playlistId) || !Number.isInteger(itemId)) {
      res.status(400).json({ error: "Invalid playlist or item id" });
      return;
    }

    const [playlist] = await db
      .select()
      .from(playlistsTable)
      .where(
        and(
          eq(playlistsTable.id, playlistId),
          eq(playlistsTable.userId, user.id),
        ),
      );

    if (!playlist) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }

    await db
      .delete(playlistItemsTable)
      .where(
        and(
          eq(playlistItemsTable.id, itemId),
          eq(playlistItemsTable.playlistId, playlistId),
        ),
      );

    res.status(204).send();
  },
);

/**
 * DELETE /playlists/:id
 * Delete playlist and all its items
 */
router.delete("/playlists/:id", requireUserAuth, async (req, res) => {
  const user = (req as any).user;
  const playlistId = Number(req.params.id);

  if (!Number.isInteger(playlistId)) {
    res.status(400).json({ error: "Invalid playlist id" });
    return;
  }

  const [playlist] = await db
    .select()
    .from(playlistsTable)
    .where(
      and(
        eq(playlistsTable.id, playlistId),
        eq(playlistsTable.userId, user.id),
      ),
    );

  if (!playlist) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }

  await db
    .delete(playlistItemsTable)
    .where(eq(playlistItemsTable.playlistId, playlistId));

  await db
    .delete(playlistsTable)
    .where(eq(playlistsTable.id, playlistId));

  res.status(204).send();
});

export default router;
