import { db, audioStoriesTable, videosTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const AUDIO =
  "https://ddsqgtiysfnxbltxrxxy.supabase.co/storage/v1/object/public/story-audio/";

const THUMB =
  "https://ddsqgtiysfnxbltxrxxy.supabase.co/storage/v1/object/public/story-thumbnails/";

async function main() {
  const audioStories = await db.select().from(audioStoriesTable);

  console.log(`Found ${audioStories.length} audio stories`);

  for (const story of audioStories) {
    const update: Record<string, string> = {};

    if (story.audioUrl?.startsWith("/api/media/files/")) {
      update.audioUrl = AUDIO + story.audioUrl.split("/").pop();
    }

    if (story.thumbnailUrl?.startsWith("/api/media/files/")) {
      update.thumbnailUrl = THUMB + story.thumbnailUrl.split("/").pop();
    }

    if (Object.keys(update).length) {
      await db
        .update(audioStoriesTable)
        .set(update)
        .where(eq(audioStoriesTable.id, story.id));

      console.log("✓", story.title);
    }
  }

  const videos = await db.select().from(videosTable);

  console.log(`Found ${videos.length} videos`);

  for (const video of videos) {
    if (
      video.thumbnailUrl &&
      video.thumbnailUrl.startsWith("/api/media/files/")
    ) {
      await db
        .update(videosTable)
        .set({
          thumbnailUrl: THUMB + video.thumbnailUrl.split("/").pop(),
        })
        .where(eq(videosTable.id, video.id));

      console.log("✓ video:", video.title);
    }
  }

  console.log("🎉 Migration complete.");
}

main().catch(console.error);
