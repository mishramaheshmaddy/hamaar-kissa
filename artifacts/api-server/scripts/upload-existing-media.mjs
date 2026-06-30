import "dotenv/config";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import { createClient } from "@supabase/supabase-js";

dotenv.config({
  path: ".env",
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const uploadsDir = "./uploads";

const files = fs.readdirSync(uploadsDir);

let uploaded = 0;
let failed = 0;
let skipped = 0;

for (let i = 0; i < files.length; i++) {
  const file = files[i];

  const ext = path.extname(file).toLowerCase();

  let bucket = null;

  if ([".mp3", ".wav", ".m4a", ".ogg"].includes(ext))
    bucket = "story-audio";

  else if (
    [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)
  )
    bucket = "story-thumbnails";

  else if (
    [".mp4", ".mov", ".mkv", ".webm"].includes(ext)
  )
    bucket = "story-videos";

  else {
    console.log(`Skipping ${file}`);
    skipped++;
    continue;
  }

  process.stdout.write(
    `[${i + 1}/${files.length}] Uploading ${file} ... `
  );

  const buffer = fs.readFileSync(
    path.join(uploadsDir, file)
  );

  const { error } = await supabase.storage
    .from(bucket)
    .upload(file, buffer, {
      upsert: true,
      contentType: mime.lookup(file) || undefined,
    });

  if (error) {
    failed++;
    console.log("FAILED");
    console.log(error.message);
  } else {
    uploaded++;
    console.log("OK");
  }
}

console.log("");
console.log("========== DONE ==========");
console.log("Uploaded :", uploaded);
console.log("Failed   :", failed);
console.log("Skipped  :", skipped);
