import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, userSubmissionsTable, usersTable, audioStoriesTable } from "@workspace/db";
import { requireUserAuth } from "./userAuth";

const router = Router();

router.post("/submissions/audio", requireUserAuth, async (req, res) => {
  const user = (req as unknown as Record<string, unknown>).user as typeof usersTable.$inferSelect;
  const { title, description, audioUrl, fileSize, durationSeconds } = req.body as {
    title: string;
    description?: string;
    audioUrl: string;
    fileSize?: number;
    durationSeconds?: number;
  };
  if (!title || !audioUrl) {
    res.status(400).json({ error: "Title and audio URL required" });
    return;
  }
  const [row] = await db.insert(userSubmissionsTable).values({
    userId: user.id,
    title,
    description: description ?? "",
    audioUrl,
    fileSize: fileSize ?? null,
    durationSeconds: durationSeconds ?? 0,
    status: "pending",
  }).returning();
  res.status(201).json(toDto(row, user));
});

router.get("/submissions/my", requireUserAuth, async (req, res) => {
  const user = (req as unknown as Record<string, unknown>).user as typeof usersTable.$inferSelect;
  const rows = await db.select().from(userSubmissionsTable).where(eq(userSubmissionsTable.userId, user.id)).orderBy(desc(userSubmissionsTable.createdAt));
  res.json(rows.map((r) => toDto(r, user)));
});

router.get("/submissions/all", async (_req, res) => {
  const rows = await db.select().from(userSubmissionsTable).orderBy(desc(userSubmissionsTable.createdAt));
  const userIds = [...new Set(rows.map((r) => r.userId))];
  let users: typeof usersTable.$inferSelect[] = [];
  if (userIds.length > 0) {
    for (const uid of userIds) {
      const u = await db.select().from(usersTable).where(eq(usersTable.id, uid));
      if (u[0]) users.push(u[0]);
    }
  }
  const userMap = new Map(users.map((u) => [u.id, u]));
  res.json(rows.map((r) => toDto(r, userMap.get(r.userId) || null)));
});

router.patch("/submissions/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const [submission] = await db.select().from(userSubmissionsTable).where(eq(userSubmissionsTable.id, id));
  if (!submission) { res.status(404).json({ error: "Not found" }); return; }

  await db.insert(audioStoriesTable).values({
    title: submission.title,
    description: submission.description,
    audioUrl: submission.audioUrl,
    durationSeconds: submission.durationSeconds,
    published: false,
    categoryId: null,
    narrator: "",
    sourceType: "url",
  });

  const [row] = await db.update(userSubmissionsTable).set({ status: "approved", updatedAt: new Date() }).where(eq(userSubmissionsTable.id, id)).returning();
  res.json(toDto(row, null));
});

router.patch("/submissions/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  const { adminNotes } = req.body as { adminNotes?: string };
  const [row] = await db.update(userSubmissionsTable).set({
    status: "rejected",
    adminNotes: adminNotes ?? null,
    updatedAt: new Date(),
  }).where(eq(userSubmissionsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(row, null));
});

function toDto(row: typeof userSubmissionsTable.$inferSelect, user: typeof usersTable.$inferSelect | null) {
  return {
    id: row.id,
    userId: row.userId,
    userName: user?.name || "",
    userPhone: user?.phone || "",
    title: row.title,
    description: row.description,
    audioUrl: row.audioUrl,
    fileSize: row.fileSize,
    durationSeconds: row.durationSeconds,
    status: row.status,
    adminNotes: row.adminNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default router;
