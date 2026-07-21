import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, audioStoriesTable, categoriesTable } from "@workspace/db";
import { requireAdmin } from "./auth";
import { syncHomeSectionAssignment } from "../lib/homeSectionSync";
import {
  CreateAudioStoryBody,
  UpdateAudioStoryBody,
  UpdateAudioStoryParams,
  DeleteAudioStoryParams,
  GetAudioStoryParams,
  ListAudioStoriesQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/audio-stories", async (req, res) => {
  const query = ListAudioStoriesQueryParams.safeParse(req.query);
  const rows = await db
    .select({
      story: audioStoriesTable,
      categoryName: categoriesTable.label,
    })
    .from(audioStoriesTable)
    .leftJoin(categoriesTable, eq(audioStoriesTable.categoryId, categoriesTable.id))
    .orderBy(audioStoriesTable.sortOrder, audioStoriesTable.id);

  const q = query.success ? query.data : undefined;
  const filtered = rows.filter((r) => {
    if (q?.published !== undefined && r.story.published !== q.published) return false;
    if (q?.categoryId !== undefined && r.story.categoryId !== q.categoryId) return false;
    if (q?.narrator && r.story.narrator !== q.narrator) return false;
    if (q?.excludeId !== undefined && r.story.id === q.excludeId) return false;
    return true;
  });

  res.json(filtered.map(({ story, categoryName }) => toDto(story, categoryName)));
});

router.post("/audio-stories", requireAdmin, async (req, res) => {
  const body = CreateAudioStoryBody.parse(req.body);
  const [row] = await db.insert(audioStoriesTable).values({
    title: body.title,
    categoryId: body.categoryId ?? null,
    narrator: body.narrator,
    durationSeconds: body.durationSeconds,
    description: body.description,
    thumbnailUrl: body.thumbnailUrl ?? null,
    audioUrl: body.audioUrl,
    sourceType: body.sourceType,
    searchTags: body.searchTags ?? "",
    published: body.published ?? false,
    sortOrder: body.sortOrder ?? 0,
    homeSectionId: body.homeSectionId ?? null,
  }).returning();
  await syncHomeSectionAssignment("audio", row.id, row.homeSectionId);
  res.status(201).json(toDto(row, null));
});

router.get("/audio-stories/:id", async (req, res) => {
  const { id } = GetAudioStoryParams.parse({ id: Number(req.params.id) });
  const rows = await db
    .select({ story: audioStoriesTable, categoryName: categoriesTable.label })
    .from(audioStoriesTable)
    .leftJoin(categoriesTable, eq(audioStoriesTable.categoryId, categoriesTable.id))
    .where(eq(audioStoriesTable.id, id));
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(rows[0].story, rows[0].categoryName));
});

router.patch("/audio-stories/:id", requireAdmin, async (req, res) => {
  const { id } = UpdateAudioStoryParams.parse({ id: Number(req.params.id) });
  const body = UpdateAudioStoryBody.parse(req.body);
  const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
  const [row] = await db.update(audioStoriesTable).set(updateData).where(eq(audioStoriesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  // Only reconcile home_section_items when the form actually sent this
  // field — bulk-upload and other partial callers that never touch
  // homeSectionId shouldn't accidentally wipe an existing assignment.
  if ("homeSectionId" in body) {
    await syncHomeSectionAssignment("audio", row.id, row.homeSectionId);
  }
  res.json(toDto(row, null));
});

router.delete("/audio-stories/:id", requireAdmin, async (req, res) => {
  const { id } = DeleteAudioStoryParams.parse({ id: Number(req.params.id) });
  await db.delete(audioStoriesTable).where(eq(audioStoriesTable.id, id));
  res.status(204).send();
});

function toDto(row: typeof audioStoriesTable.$inferSelect, categoryName: string | null | undefined) {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.categoryId,
    categoryName: categoryName ?? null,
    narrator: row.narrator,
    durationSeconds: row.durationSeconds,
    description: row.description,
    thumbnailUrl: row.thumbnailUrl ?? null,
    audioUrl: row.audioUrl,
    sourceType: row.sourceType,
    searchTags: row.searchTags ?? "",
    published: row.published,
    sortOrder: row.sortOrder,
    homeSectionId: row.homeSectionId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default router;
