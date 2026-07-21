import { db, homeSectionItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

/**
 * Keeps home_section_items in sync with a single audio story/video's
 * homeSectionId field (the simple dropdown on the Add/Edit form).
 *
 * home_section_items is the ONLY thing the mobile home screen's
 * GET /api/home-sections actually reads to populate a section's items —
 * the homeSectionId column on the story/video row is otherwise never
 * consulted by anything. Without this sync, picking a section in the
 * form silently did nothing, regardless of what was saved to that column.
 */
export async function syncHomeSectionAssignment(
  contentType: "audio" | "video",
  contentId: number,
  homeSectionId: number | null | undefined,
): Promise<void> {
  // Always clear any previous assignment for this item first, regardless
  // of which section it was in — this is what makes moving between
  // sections, or clearing back to "-- Koi nahi --", actually work.
  await db
    .delete(homeSectionItemsTable)
    .where(and(eq(homeSectionItemsTable.contentType, contentType), eq(homeSectionItemsTable.contentId, contentId)));

  if (!homeSectionId) return;

  const existingInSection = await db
    .select({ id: homeSectionItemsTable.id })
    .from(homeSectionItemsTable)
    .where(eq(homeSectionItemsTable.homeSectionId, homeSectionId));

  await db.insert(homeSectionItemsTable).values({
    homeSectionId,
    contentType,
    contentId,
    sortOrder: existingInSection.length, // append after existing manually-curated items
  });
}
