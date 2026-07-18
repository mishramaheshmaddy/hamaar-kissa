import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, videosTable, categoriesTable } from "@workspace/db";
import { requireAdmin } from "./auth";
import {
  CreateVideoBody,
  UpdateVideoBody,
  UpdateVideoParams,
  DeleteVideoParams,
  GetVideoParams,
  ListVideosQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/videos", async (req, res) => {
  const query = ListVideosQueryParams.safeParse(req.query);
  const rows = await db
    .select({ video: videosTable, categoryName: categoriesTable.label })
    .from(videosTable)
    .leftJoin(categoriesTable, eq(videosTable.categoryId, categoriesTable.id))
    .orderBy(videosTable.sortOrder, videosTable.id);

  const filtered = rows.filter((r) => {
    if (query.success && query.data.published !== undefined) {
      return r.video.published === query.data.published;
    }
    return true;
  });

  res.json(filtered.map(({ video, categoryName }) => toDto(video, categoryName)));
});

router.post("/videos", requireAdmin, async (req, res) => {
  const body = CreateVideoBody.parse(req.body);
  const [row] = await db.insert(videosTable).values({
    title: body.title,
    categoryId: body.categoryId ?? null,
    description: body.description,
    thumbnailUrl: body.thumbnailUrl ?? null,
    videoUrl: body.videoUrl,
    sourceType: body.sourceType,
    youtubeId: body.youtubeId ?? null,
    searchTags: body.searchTags ?? "",
    views: body.views ?? 0,
    published: body.published ?? false,
    sortOrder: body.sortOrder ?? 0,
  }).returning();
  res.status(201).json(toDto(row, null));
});

router.get("/videos/:id", async (req, res) => {
  const { id } = GetVideoParams.parse({ id: Number(req.params.id) });
  const rows = await db
    .select({ video: videosTable, categoryName: categoriesTable.label })
    .from(videosTable)
    .leftJoin(categoriesTable, eq(videosTable.categoryId, categoriesTable.id))
    .where(eq(videosTable.id, id));
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(rows[0].video, rows[0].categoryName));
});

router.patch("/videos/:id", requireAdmin, async (req, res) => {
  const { id } = UpdateVideoParams.parse({ id: Number(req.params.id) });
  const body = UpdateVideoBody.parse(req.body);
  const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
  const [row] = await db.update(videosTable).set(updateData).where(eq(videosTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(row, null));
});

router.delete("/videos/:id", requireAdmin, async (req, res) => {
  const { id } = DeleteVideoParams.parse({ id: Number(req.params.id) });
  await db.delete(videosTable).where(eq(videosTable.id, id));
  res.status(204).send();
});

function toDto(row: typeof videosTable.$inferSelect, categoryName: string | null | undefined) {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.categoryId,
    categoryName: categoryName ?? null,
    description: row.description,
    thumbnailUrl: row.thumbnailUrl ?? null,
    videoUrl: row.videoUrl,
    sourceType: row.sourceType,
    youtubeId: row.youtubeId ?? null,
    searchTags: row.searchTags ?? "",
    views: row.views,
    published: row.published,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default router;
