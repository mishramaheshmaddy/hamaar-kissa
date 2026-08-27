import { Router } from "express";
import { and, count, desc, eq, gte, ilike, or } from "drizzle-orm";
import {
  db,
  usersTable,
  categoriesTable,
  audioStoriesTable,
  videosTable,
  userSubmissionsTable,
  pushTokensTable,
  scheduledNotificationsTable,
  analyticsEventsTable,
  playlistsTable,
  playlistItemsTable,
} from "@workspace/db";
import { requireAdmin } from "./auth";
import { verifyUserToken } from "./userAuth";

const router = Router();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Phase 2 event types the mobile app is allowed to send. Kept as a fixed
// list (rather than accepting anything the client sends) so a typo or a
// future ad-hoc event on the client can't silently pollute the table.
const ANALYTICS_EVENT_TYPES = ["story_play", "video_play", "download", "like", "like_removed", "save", "save_removed", "share"] as const;
type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

function isAnalyticsEventType(v: unknown): v is AnalyticsEventType {
  return typeof v === "string" && (ANALYTICS_EVENT_TYPES as readonly string[]).includes(v);
}

// content_type is deliberately open-ended at the schema level, but Phase 2
// only ever produces these two.
const ANALYTICS_CONTENT_TYPES = ["story", "video"] as const;
type AnalyticsContentType = (typeof ANALYTICS_CONTENT_TYPES)[number];

function isAnalyticsContentType(v: unknown): v is AnalyticsContentType {
  return typeof v === "string" && (ANALYTICS_CONTENT_TYPES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------
// Event tracking — POST /api/analytics
// Fire-and-forget from the mobile app for story_play / video_play /
// download / like / save. No admin auth (called by end users), and an
// optional Bearer token is read on a best-effort basis only — a missing
// or invalid token still records the event, just with userId: null,
// since this must never block or fail visibly for the person using the app.
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// Story engagement stats — GET /api/analytics/story/:id
// ---------------------------------------------------------------------
router.get("/analytics/story/:id", async (req, res) => {
  try {
    const storyId = Number(req.params.id);

    if (!Number.isInteger(storyId)) {
      res.status(400).json({ error: "Invalid story id" });
      return;
    }

    const [reactionRows, shareRows, downloadUsers, playlistUsers] =
      await Promise.all([
        db
          .select({
            userId: analyticsEventsTable.userId,
            eventType: analyticsEventsTable.eventType,
          })
          .from(analyticsEventsTable)
          .where(
            and(
              eq(analyticsEventsTable.contentType, "story"),
              eq(analyticsEventsTable.contentId, storyId),
              or(
                eq(analyticsEventsTable.eventType, "like"),
                eq(analyticsEventsTable.eventType, "like_removed"),
                eq(analyticsEventsTable.eventType, "save"),
                eq(analyticsEventsTable.eventType, "save_removed"),
              ),
            ),
          )
          .orderBy(desc(analyticsEventsTable.id)),

        db
          .select({ count: count() })
          .from(analyticsEventsTable)
          .where(
            and(
              eq(analyticsEventsTable.contentType, "story"),
              eq(analyticsEventsTable.contentId, storyId),
              eq(analyticsEventsTable.eventType, "share"),
            ),
          ),

        db
          .selectDistinct({
            userId: analyticsEventsTable.userId,
          })
          .from(analyticsEventsTable)
          .where(
            and(
              eq(analyticsEventsTable.contentType, "story"),
              eq(analyticsEventsTable.contentId, storyId),
              eq(analyticsEventsTable.eventType, "download"),
            ),
          ),

        db
          .selectDistinct({
            userId: playlistsTable.userId,
          })
          .from(playlistItemsTable)
          .innerJoin(
            playlistsTable,
            eq(playlistItemsTable.playlistId, playlistsTable.id),
          )
          .where(eq(playlistItemsTable.audioStoryId, storyId)),
      ]);

    const latestLikeByUser = new Map<number, string>();
    const latestSaveByUser = new Map<number, string>();

    for (const row of reactionRows) {
      if (row.userId === null) continue;

      if (
        row.eventType === "like" ||
        row.eventType === "like_removed"
      ) {
        if (!latestLikeByUser.has(row.userId)) {
          latestLikeByUser.set(row.userId, row.eventType);
        }
      }

      if (
        row.eventType === "save" ||
        row.eventType === "save_removed"
      ) {
        if (!latestSaveByUser.has(row.userId)) {
          latestSaveByUser.set(row.userId, row.eventType);
        }
      }
    }

    const likes = Array.from(latestLikeByUser.values()).filter(
      (eventType) => eventType === "like",
    ).length;

    const saves = Array.from(latestSaveByUser.values()).filter(
      (eventType) => eventType === "save",
    ).length;

    const shares = Number(shareRows[0]?.count ?? 0);

    const downloads = downloadUsers.filter(
      (row) => row.userId !== null,
    ).length;

    const playlistAdds = playlistUsers.length;

    res.json({
      likes,
      saves,
      shares,
      playlistAdds,
      downloads,
    });
  } catch (e) {
    console.error("GET /analytics/story/:id error:", e);
    res.status(500).json({ error: "Failed to load story stats" });
  }
});

router.post("/analytics", async (req, res) => {
  try {
    const { eventType, contentType, contentId } = req.body as {
      eventType?: string;
      contentType?: string | null;
      contentId?: number | string | null;
    };

    if (!isAnalyticsEventType(eventType)) {
      res.status(400).json({ error: "Invalid or missing eventType" });
      return;
    }

    let normalizedContentType: AnalyticsContentType | null = null;
    if (contentType !== undefined && contentType !== null) {
      if (!isAnalyticsContentType(contentType)) {
        res.status(400).json({ error: "Invalid contentType" });
        return;
      }
      normalizedContentType = contentType;
    }

    let normalizedContentId: number | null = null;
    if (contentId !== undefined && contentId !== null && contentId !== "") {
      const n = Number(contentId);
      if (Number.isNaN(n)) {
        res.status(400).json({ error: "Invalid contentId" });
        return;
      }
      normalizedContentId = n;
    }

    // Optional — logged-in users get attributed, guests don't.
    let userId: number | null = null;
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const decoded = verifyUserToken(auth.slice(7));
      if (decoded) userId = decoded.userId;
    }

    await db.insert(analyticsEventsTable).values({
      userId,
      eventType,
      contentType: normalizedContentType,
      contentId: normalizedContentId,
    });

    res.status(201).json({ ok: true });
  } catch (e) {
    console.error("POST /analytics error:", e);
    res.status(500).json({ error: "Failed to record event" });
  }
});

// ---------------------------------------------------------------------
// Overview — the top summary cards
// ---------------------------------------------------------------------
router.get("/admin/analytics/overview", requireAdmin, async (_req, res) => {
  try {
    const since7d = daysAgo(7);
    const since30d = daysAgo(30);

    const [
      [totalUsersRow],
      [newUsers7dRow],
      [newUsers30dRow],
      [totalAudioRow],
      [publishedAudioRow],
      [totalVideosRow],
      [publishedVideosRow],
      [totalCategoriesRow],
      [activeCategoriesRow],
      [totalDevicesRow],
      [pendingSubsRow],
      [approvedSubsRow],
      [rejectedSubsRow],
      [notificationsSentRow],
      [storyPlaysRow],
      [videoPlaysRow],
      [downloadsRow],
      [likesRow],
      [savesRow],
    ] = await Promise.all([
      db.select({ c: count() }).from(usersTable),
      db.select({ c: count() }).from(usersTable).where(gte(usersTable.createdAt, since7d)),
      db.select({ c: count() }).from(usersTable).where(gte(usersTable.createdAt, since30d)),
      db.select({ c: count() }).from(audioStoriesTable),
      db.select({ c: count() }).from(audioStoriesTable).where(eq(audioStoriesTable.published, true)),
      db.select({ c: count() }).from(videosTable),
      db.select({ c: count() }).from(videosTable).where(eq(videosTable.published, true)),
      db.select({ c: count() }).from(categoriesTable),
      db.select({ c: count() }).from(categoriesTable).where(eq(categoriesTable.active, true)),
      db.select({ c: count() }).from(pushTokensTable),
      db.select({ c: count() }).from(userSubmissionsTable).where(eq(userSubmissionsTable.status, "pending")),
      db.select({ c: count() }).from(userSubmissionsTable).where(eq(userSubmissionsTable.status, "approved")),
      db.select({ c: count() }).from(userSubmissionsTable).where(eq(userSubmissionsTable.status, "rejected")),
      db.select({ c: count() }).from(scheduledNotificationsTable).where(eq(scheduledNotificationsTable.status, "sent")),
      db.select({ c: count() }).from(analyticsEventsTable).where(eq(analyticsEventsTable.eventType, "story_play")),
      db.select({ c: count() }).from(analyticsEventsTable).where(eq(analyticsEventsTable.eventType, "video_play")),
      db.select({ c: count() }).from(analyticsEventsTable).where(eq(analyticsEventsTable.eventType, "download")),
      db.select({ c: count() }).from(analyticsEventsTable).where(eq(analyticsEventsTable.eventType, "like")),
      db.select({ c: count() }).from(analyticsEventsTable).where(eq(analyticsEventsTable.eventType, "save")),
    ]);

    res.json({
      users: {
        total: totalUsersRow?.c ?? 0,
        new7d: newUsers7dRow?.c ?? 0,
        new30d: newUsers30dRow?.c ?? 0,
      },
      audioStories: {
        total: totalAudioRow?.c ?? 0,
        published: publishedAudioRow?.c ?? 0,
      },
      videos: {
        total: totalVideosRow?.c ?? 0,
        published: publishedVideosRow?.c ?? 0,
      },
      categories: {
        total: totalCategoriesRow?.c ?? 0,
        active: activeCategoriesRow?.c ?? 0,
      },
      // Registered devices (push tokens) — the closest proxy we have today
      // to "app installs", since there's no app-open/session tracking yet.
      devices: totalDevicesRow?.c ?? 0,
      submissions: {
        pending: pendingSubsRow?.c ?? 0,
        approved: approvedSubsRow?.c ?? 0,
        rejected: rejectedSubsRow?.c ?? 0,
      },
      notificationsSent: notificationsSentRow?.c ?? 0,
      events: {
        storyPlays: storyPlaysRow?.c ?? 0,
        videoPlays: videoPlaysRow?.c ?? 0,
        downloads: downloadsRow?.c ?? 0,
        likes: likesRow?.c ?? 0,
        saves: savesRow?.c ?? 0,
      },
    });
  } catch (e) {
    console.error("GET /admin/analytics/overview error:", e);
    res.status(500).json({ error: "Failed to load analytics overview" });
  }
});

// ---------------------------------------------------------------------
// Growth — daily new-user signups + new content added, for a line chart
// ---------------------------------------------------------------------
router.get("/admin/analytics/growth", requireAdmin, async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
    const since = daysAgo(days - 1);
    since.setHours(0, 0, 0, 0);

    const [users, audio, videos] = await Promise.all([
      db.select({ createdAt: usersTable.createdAt }).from(usersTable).where(gte(usersTable.createdAt, since)),
      db
        .select({ createdAt: audioStoriesTable.createdAt })
        .from(audioStoriesTable)
        .where(gte(audioStoriesTable.createdAt, since)),
      db.select({ createdAt: videosTable.createdAt }).from(videosTable).where(gte(videosTable.createdAt, since)),
    ]);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const buckets = new Map<string, { date: string; users: number; audioStories: number; videos: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = fmt(d);
      buckets.set(key, { date: key, users: 0, audioStories: 0, videos: 0 });
    }

    const bump = (rows: { createdAt: Date }[], field: "users" | "audioStories" | "videos") => {
      for (const r of rows) {
        const key = fmt(new Date(r.createdAt));
        const bucket = buckets.get(key);
        if (bucket) bucket[field]++;
      }
    };
    bump(users, "users");
    bump(audio, "audioStories");
    bump(videos, "videos");

    res.json(Array.from(buckets.values()));
  } catch (e) {
    console.error("GET /admin/analytics/growth error:", e);
    res.status(500).json({ error: "Failed to load growth data" });
  }
});

// ---------------------------------------------------------------------
// Category breakdown — content count per category
// ---------------------------------------------------------------------
router.get("/admin/analytics/categories", requireAdmin, async (_req, res) => {
  try {
    const [cats, audioCounts, videoCounts] = await Promise.all([
      db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder, categoriesTable.id),
      db
        .select({ categoryId: audioStoriesTable.categoryId, c: count() })
        .from(audioStoriesTable)
        .groupBy(audioStoriesTable.categoryId),
      db.select({ categoryId: videosTable.categoryId, c: count() }).from(videosTable).groupBy(videosTable.categoryId),
    ]);

    const audioMap = new Map(audioCounts.map((r) => [r.categoryId, r.c]));
    const videoMap = new Map(videoCounts.map((r) => [r.categoryId, r.c]));

    const result = cats
      .map((c) => {
        const audioCount = audioMap.get(c.id) ?? 0;
        const videoCount = videoMap.get(c.id) ?? 0;
        return {
          id: c.id,
          name: c.name,
          label: c.label,
          icon: c.icon,
          type: c.type,
          active: c.active,
          audioCount,
          videoCount,
          totalCount: audioCount + videoCount,
        };
      })
      .sort((a, b) => b.totalCount - a.totalCount);

    res.json(result);
  } catch (e) {
    console.error("GET /admin/analytics/categories error:", e);
    res.status(500).json({ error: "Failed to load category breakdown" });
  }
});

// ---------------------------------------------------------------------
// Audio analytics — plays / downloads / likes / saves per story
// ---------------------------------------------------------------------
router.get("/admin/analytics/audio", requireAdmin, async (_req, res) => {
  try {
    const [stories, playCounts, downloadCounts, likeCounts, saveCounts] = await Promise.all([
      db.select({ id: audioStoriesTable.id, title: audioStoriesTable.title }).from(audioStoriesTable),
      db
        .select({ contentId: analyticsEventsTable.contentId, c: count() })
        .from(analyticsEventsTable)
        .where(and(eq(analyticsEventsTable.contentType, "story"), eq(analyticsEventsTable.eventType, "story_play")))
        .groupBy(analyticsEventsTable.contentId),
      db
        .select({ contentId: analyticsEventsTable.contentId, c: count() })
        .from(analyticsEventsTable)
        .where(and(eq(analyticsEventsTable.contentType, "story"), eq(analyticsEventsTable.eventType, "download")))
        .groupBy(analyticsEventsTable.contentId),
      db
        .select({ contentId: analyticsEventsTable.contentId, c: count() })
        .from(analyticsEventsTable)
        .where(and(eq(analyticsEventsTable.contentType, "story"), eq(analyticsEventsTable.eventType, "like")))
        .groupBy(analyticsEventsTable.contentId),
      db
        .select({ contentId: analyticsEventsTable.contentId, c: count() })
        .from(analyticsEventsTable)
        .where(and(eq(analyticsEventsTable.contentType, "story"), eq(analyticsEventsTable.eventType, "save")))
        .groupBy(analyticsEventsTable.contentId),
    ]);

    const playMap = new Map(playCounts.map((r) => [r.contentId, r.c]));
    const downloadMap = new Map(downloadCounts.map((r) => [r.contentId, r.c]));
    const likeMap = new Map(likeCounts.map((r) => [r.contentId, r.c]));
    const saveMap = new Map(saveCounts.map((r) => [r.contentId, r.c]));

    const result = stories
      .map((s) => ({
        id: s.id,
        title: s.title,
        plays: playMap.get(s.id) ?? 0,
        downloads: downloadMap.get(s.id) ?? 0,
        likes: likeMap.get(s.id) ?? 0,
        saves: saveMap.get(s.id) ?? 0,
      }))
      .sort((a, b) => b.plays - a.plays);

    res.json(result);
  } catch (e) {
    console.error("GET /admin/analytics/audio error:", e);
    res.status(500).json({ error: "Failed to load audio analytics" });
  }
});

// ---------------------------------------------------------------------
// Video analytics — views (video_play events) per video
// ---------------------------------------------------------------------
router.get("/admin/analytics/videos", requireAdmin, async (_req, res) => {
  try {
    const [vids, playCounts] = await Promise.all([
      db.select({ id: videosTable.id, title: videosTable.title }).from(videosTable),
      db
        .select({ contentId: analyticsEventsTable.contentId, c: count() })
        .from(analyticsEventsTable)
        .where(and(eq(analyticsEventsTable.contentType, "video"), eq(analyticsEventsTable.eventType, "video_play")))
        .groupBy(analyticsEventsTable.contentId),
    ]);

    const playMap = new Map(playCounts.map((r) => [r.contentId, r.c]));

    const result = vids
      .map((v) => ({
        id: v.id,
        title: v.title,
        views: playMap.get(v.id) ?? 0,
      }))
      .sort((a, b) => b.views - a.views);

    res.json(result);
  } catch (e) {
    console.error("GET /admin/analytics/videos error:", e);
    res.status(500).json({ error: "Failed to load video analytics" });
  }
});

// ---------------------------------------------------------------------
// Downloads dashboard — most downloaded stories
// ---------------------------------------------------------------------
router.get("/admin/analytics/downloads", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

    const [stories, downloadCounts] = await Promise.all([
      db.select({ id: audioStoriesTable.id, title: audioStoriesTable.title }).from(audioStoriesTable),
      db
        .select({ contentId: analyticsEventsTable.contentId, c: count() })
        .from(analyticsEventsTable)
        .where(and(eq(analyticsEventsTable.contentType, "story"), eq(analyticsEventsTable.eventType, "download")))
        .groupBy(analyticsEventsTable.contentId),
    ]);

    const downloadMap = new Map(downloadCounts.map((r) => [r.contentId, r.c]));

    const result = stories
      .map((s) => ({ id: s.id, title: s.title, downloads: downloadMap.get(s.id) ?? 0 }))
      .filter((s) => s.downloads > 0)
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);

    res.json(result);
  } catch (e) {
    console.error("GET /admin/analytics/downloads error:", e);
    res.status(500).json({ error: "Failed to load downloads dashboard" });
  }
});

// ---------------------------------------------------------------------
// Users — searchable, paginated list including phone numbers
// ---------------------------------------------------------------------
router.get("/admin/analytics/users", requireAdmin, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 25, 1), 100);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const whereClause = search
      ? or(
          ilike(usersTable.phone, `%${search}%`),
          ilike(usersTable.name, `%${search}%`),
          ilike(usersTable.email, `%${search}%`)
        )
      : undefined;

    const [totalRow] = await db.select({ c: count() }).from(usersTable).where(whereClause);
    const rows = await db
      .select()
      .from(usersTable)
      .where(whereClause)
      .orderBy(desc(usersTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    res.json({
      total: totalRow?.c ?? 0,
      page,
      pageSize,
      users: rows.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        authProvider: u.authProvider,
        createdAt: u.createdAt,
        city: u.city,
        region: u.region,
        country: u.country,
        lastLoginAt: u.lastLoginAt,
      })),
    });
  } catch (e) {
    console.error("GET /admin/analytics/users error:", e);
    res.status(500).json({ error: "Failed to load users" });
  }
});

export default router;
