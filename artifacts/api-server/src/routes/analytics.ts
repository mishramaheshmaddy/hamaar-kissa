import { Router } from "express";
import { count, desc, eq, gte, ilike, or } from "drizzle-orm";
import {
  db,
  usersTable,
  categoriesTable,
  audioStoriesTable,
  videosTable,
  userSubmissionsTable,
  pushTokensTable,
  scheduledNotificationsTable,
} from "@workspace/db";
import { requireAdmin } from "./auth";

const router = Router();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

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
      })),
    });
  } catch (e) {
    console.error("GET /admin/analytics/users error:", e);
    res.status(500).json({ error: "Failed to load users" });
  }
});

export default router;
