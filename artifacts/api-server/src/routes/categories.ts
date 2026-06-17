import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  UpdateCategoryParams,
  DeleteCategoryParams,
  GetCategoryParams,
  ListCategoriesQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/categories", async (req, res) => {
  const query = ListCategoriesQueryParams.safeParse(req.query);
  let rows = await db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder, categoriesTable.id);
  if (query.success && query.data.type) {
    rows = rows.filter((r) => r.type === query.data.type);
  }
  res.json(rows.map(toDto));
});

router.post("/categories", async (req, res) => {
  const body = CreateCategoryBody.parse(req.body);
  const [row] = await db.insert(categoriesTable).values({
    name: body.name,
    label: body.label,
    icon: body.icon,
    type: body.type,
    sortOrder: body.sortOrder ?? 0,
    active: body.active ?? true,
  }).returning();
  res.status(201).json(toDto(row));
});

router.get("/categories/:id", async (req, res) => {
  const { id } = GetCategoryParams.parse({ id: Number(req.params.id) });
  const rows = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(rows[0]));
});

router.patch("/categories/:id", async (req, res) => {
  const { id } = UpdateCategoryParams.parse({ id: Number(req.params.id) });
  const body = UpdateCategoryBody.parse(req.body);
  const [row] = await db.update(categoriesTable).set({
    ...body,
    updatedAt: new Date(),
  }).where(eq(categoriesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toDto(row));
});

router.delete("/categories/:id", async (req, res) => {
  const { id } = DeleteCategoryParams.parse({ id: Number(req.params.id) });
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.status(204).send();
});

function toDto(row: typeof categoriesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    icon: row.icon,
    type: row.type,
    sortOrder: row.sortOrder,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default router;
