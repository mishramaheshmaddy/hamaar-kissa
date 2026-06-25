import { Router } from "express";
import { eq, desc, asc } from "drizzle-orm";
import { db, homeSectionsTable, audioStoriesTable, videosTable, categoriesTable } from "@workspace/db";

const router = Router();

router.get("/home-sections", async (req, res) => {
  const sections = await db.select().from(homeSectionsTable).where(eq(homeSectionsTable.isActive, true)).orderBy(asc(homeSectionsTable.sortOrder));

  const result = await Promise.all(
    sections.map(async (section) => {
      let items: Array<Record<string, unknown>> = [];

      if (section.contentSource === "category" && section.categoryId) {
        if (section.type === "audio") {
          const rows = await db
            .select({ story: audioStoriesTable, categoryName: categoriesTable.label })
            .from(audioStoriesTable)
            .leftJoin(categoriesTable, eq(audioStoriesTable.categoryId, categoriesTable.id))
            .where(eq(audioStoriesTable.categoryId, section.categoryId))
            .orderBy(desc(audioStoriesTable.id))
            .limit(10);
          items = rows.map(({ story, categoryName }) => ({
            id: story.id,
            title: story.title,
            categoryName: categoryName ?? null,
            narrator: story.narrator,
            durationSeconds: story.durationSeconds,
            thumbnailUrl: story.thumbnailUrl ?? null,
            audioUrl: story.audioUrl,
            type: "audio",
          }));
        } else if (section.type === "video") {
          const rows = await db
            .select({ video: videosTable, categoryName: categoriesTable.label })
            .from(videosTable)
            .leftJoin(categoriesTable, eq(videosTable.categoryId, categoriesTable.id))
            .where(eq(videosTable.categoryId, section.categoryId))
            .orderBy(desc(videosTable.id))
            .limit(10);
          items = rows.map(({ video, categoryName }) => ({
            id: video.id,
            title: video.title,
            categoryName: categoryName ?? null,
            thumbnailUrl: video.thumbnailUrl ?? null,
            videoUrl: video.videoUrl,
            type: "video",
          }));
        } else {
          const audioRows = await db
            .select({ story: audioStoriesTable, categoryName: categoriesTable.label })
            .from(audioStoriesTable)
            .leftJoin(categoriesTable, eq(audioStoriesTable.categoryId, categoriesTable.id))
            .where(eq(audioStoriesTable.categoryId, section.categoryId))
            .orderBy(desc(audioStoriesTable.id))
            .limit(5);
          const videoRows = await db
            .select({ video: videosTable, categoryName: categoriesTable.label })
            .from(videosTable)
            .leftJoin(categoriesTable, eq(videosTable.categoryId, categoriesTable.id))
            .where(eq(videosTable.categoryId, section.categoryId))
            .orderBy(desc(videosTable.id))
            .limit(5);
          items = [
            ...audioRows.map(({ story, categoryName }) => ({
              id: story.id,
              title: story.title,
              categoryName: categoryName ?? null,
              narrator: story.narrator,
              durationSeconds: story.durationSeconds,
              thumbnailUrl: story.thumbnailUrl ?? null,
              audioUrl: story.audioUrl,
              type: "audio" as const,
            })),
            ...videoRows.map(({ video, categoryName }) => ({
              id: video.id,
              title: video.title,
              categoryName: categoryName ?? null,
              thumbnailUrl: video.thumbnailUrl ?? null,
              videoUrl: video.videoUrl,
              type: "video" as const,
            })),
          ];
        }
      } else if (section.contentSource === "featured") {
        if (section.type === "audio" || section.type === "both") {
          const rows = await db
            .select({ story: audioStoriesTable, categoryName: categoriesTable.label })
            .from(audioStoriesTable)
            .leftJoin(categoriesTable, eq(audioStoriesTable.categoryId, categoriesTable.id))
            .where(eq(audioStoriesTable.published, true))
            .orderBy(desc(audioStoriesTable.id))
            .limit(section.type === "both" ? 5 : 10);
          items.push(...rows.map(({ story, categoryName }) => ({
            id: story.id,
            title: story.title,
            categoryName: categoryName ?? null,
            narrator: story.narrator,
            durationSeconds: story.durationSeconds,
            thumbnailUrl: story.thumbnailUrl ?? null,
            audioUrl: story.audioUrl,
            type: "audio" as const,
          })));
        }
        if (section.type === "video" || section.type === "both") {
          const rows = await db
            .select({ video: videosTable, categoryName: categoriesTable.label })
            .from(videosTable)
            .leftJoin(categoriesTable, eq(videosTable.categoryId, categoriesTable.id))
            .where(eq(videosTable.published, true))
            .orderBy(desc(videosTable.id))
            .limit(section.type === "both" ? 5 : 10);
          items.push(...rows.map(({ video, categoryName }) => ({
            id: video.id,
            title: video.title,
            categoryName: categoryName ?? null,
            thumbnailUrl: video.thumbnailUrl ?? null,
            videoUrl: video.videoUrl,
            type: "video" as const,
          })));
        }
      } else if (section.contentSource === "latest") {
        if (section.type === "audio" || section.type === "both") {
          const rows = await db
            .select({ story: audioStoriesTable, categoryName: categoriesTable.label })
            .from(audioStoriesTable)
            .leftJoin(categoriesTable, eq(audioStoriesTable.categoryId, categoriesTable.id))
            .orderBy(desc(audioStoriesTable.createdAt))
            .limit(section.type === "both" ? 5 : 10);
          items.push(...rows.map(({ story, categoryName }) => ({
            id: story.id,
            title: story.title,
            categoryName: categoryName ?? null,
            narrator: story.narrator,
            durationSeconds: story.durationSeconds,
            thumbnailUrl: story.thumbnailUrl ?? null,
            audioUrl: story.audioUrl,
            type: "audio" as const,
          })));
        }
        if (section.type === "video" || section.type === "both") {
          const rows = await db
            .select({ video: videosTable, categoryName: categoriesTable.label })
            .from(videosTable)
            .leftJoin(categoriesTable, eq(videosTable.categoryId, categoriesTable.id))
            .orderBy(desc(videosTable.createdAt))
            .limit(section.type === "both" ? 5 : 10);
          items.push(...rows.map(({ video, categoryName }) => ({
            id: video.id,
            title: video.title,
            categoryName: categoryName ?? null,
            thumbnailUrl: video.thumbnailUrl ?? null,
            videoUrl: video.videoUrl,
            type: "video" as const,
          })));
        }
      } else if (section.contentSource === "manual") {
        // Fetch items directly assigned to this home section
        if (section.type === "audio" || section.type === "both") {
          const rows = await db
            .select({ story: audioStoriesTable, categoryName: categoriesTable.label })
            .from(audioStoriesTable)
            .leftJoin(categoriesTable, eq(audioStoriesTable.categoryId, categoriesTable.id))
            .where(eq((audioStoriesTable as any).homeSectionId, section.id))
            .orderBy(desc(audioStoriesTable.id))
            .limit(10);
          items.push(...rows.map(({ story, categoryName }) => ({
            id: story.id,
            title: story.title,
            categoryName: categoryName ?? null,
            narrator: story.narrator,
            durationSeconds: story.durationSeconds,
            thumbnailUrl: story.thumbnailUrl ?? null,
            audioUrl: story.audioUrl,
            type: "audio" as const,
          })));
        }
        if (section.type === "video" || section.type === "both") {
          const rows = await db
            .select({ video: videosTable, categoryName: categoriesTable.label })
            .from(videosTable)
            .leftJoin(categoriesTable, eq(videosTable.categoryId, categoriesTable.id))
            .where(eq((videosTable as any).homeSectionId, section.id))
            .orderBy(desc(videosTable.id))
            .limit(10);
          items.push(...rows.map(({ video, categoryName }) => ({
            id: video.id,
            title: video.title,
            categoryName: categoryName ?? null,
            thumbnailUrl: video.thumbnailUrl ?? null,
            videoUrl: video.videoUrl,
            type: "video" as const,
          })));
        }
      } else if (section.contentSource === "trending") {
        if (section.type === "audio" || section.type === "both") {
          const rows = await db
            .select({ story: audioStoriesTable, categoryName: categoriesTable.label })
            .from(audioStoriesTable)
            .leftJoin(categoriesTable, eq(audioStoriesTable.categoryId, categoriesTable.id))
            .where(eq(audioStoriesTable.published, true))
            .orderBy(desc(audioStoriesTable.id))
            .limit(section.type === "both" ? 5 : 10);
          items.push(...rows.map(({ story, categoryName }) => ({
            id: story.id,
            title: story.title,
            categoryName: categoryName ?? null,
            narrator: story.narrator,
            durationSeconds: story.durationSeconds,
            thumbnailUrl: story.thumbnailUrl ?? null,
            audioUrl: story.audioUrl,
            type: "audio" as const,
          })));
        }
        if (section.type === "video" || section.type === "both") {
          const rows = await db
            .select({ video: videosTable, categoryName: categoriesTable.label })
            .from(videosTable)
            .leftJoin(categoriesTable, eq(videosTable.categoryId, categoriesTable.id))
            .where(eq(videosTable.published, true))
            .orderBy(desc(videosTable.views))
            .limit(section.type === "both" ? 5 : 10);
          items.push(...rows.map(({ video, categoryName }) => ({
            id: video.id,
            title: video.title,
            categoryName: categoryName ?? null,
            thumbnailUrl: video.thumbnailUrl ?? null,
            videoUrl: video.videoUrl,
            type: "video" as const,
          })));
        }
      }

      return {
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        type: section.type,
        contentSource: section.contentSource,
        categoryId: section.categoryId,
        sortOrder: section.sortOrder,
        isActive: section.isActive,
        items: items.slice(0, 10),
      };
    })
  );

  res.json(result);
});

router.get("/home-sections/all", async (_req, res) => {
  const rows = await db.select().from(homeSectionsTable).orderBy(asc(homeSectionsTable.sortOrder));
  res.json(rows.map(toDto));
});

router.post("/home-sections", async (req, res) => {
  const body = req.body as {
    title: string;
    subtitle?: string;
    type?: string;
    contentSource?: string;
    categoryId?: number;
    sortOrder?: number;
    isActive?: boolean;
  };
  const [row] = await db.insert(homeSectionsTable).values({
    title: body.title,
    subtitle: body.subtitle ?? "",
    type: body.type ?? "audio",
    contentSource: body.contentSource ?? "latest",
    categoryId: body.categoryId ?? null,
    sortOrder: body.sortOrder ?? 0,
    isActive: body.isActive ?? true,
  }).returning();
  res.status(201).json(toDto(row));
});

router.patch("/home-sections/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as Record<string, unknown>;
  const [row] = await db.update(homeSectionsTable).set({ ...body, updatedAt: new Date() }).where(eq(homeSectionsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(row));
});

router.put("/home-sections/reorder", async (req, res) => {
  const items = req.body as Array<{ id: number; sortOrder: number }>;
  await Promise.all(
    items.map((item) => db.update(homeSectionsTable).set({ sortOrder: item.sortOrder, updatedAt: new Date() }).where(eq(homeSectionsTable.id, item.id)))
  );
  res.json({ ok: true });
});

router.delete("/home-sections/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(homeSectionsTable).where(eq(homeSectionsTable.id, id));
  res.status(204).send();
});

function toDto(row: typeof homeSectionsTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    type: row.type,
    contentSource: row.contentSource,
    categoryId: row.categoryId,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default router;
