import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, audioStoriesTable, videosTable } from "@workspace/db";

const router = Router();

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.haamarkissa.app&pcampaignid=web_share";

router.get("/share/:type/:id", async (req, res) => {
  const { type, id } = req.params as { type: string; id: string };
  const contentId = Number(id);

  if (type === "audio") {
    const rows = await db.select().from(audioStoriesTable).where(eq(audioStoriesTable.id, contentId));
    if (!rows[0]) {
      res.status(404).send(notFoundHtml());
      return;
    }
    const item = rows[0];
    res.send(landingHtml(item.title, item.description, item.thumbnailUrl || "", "audio", contentId));
    return;
  }

  if (type === "video") {
    const rows = await db.select().from(videosTable).where(eq(videosTable.id, contentId));
    if (!rows[0]) {
      res.status(404).send(notFoundHtml());
      return;
    }
    const item = rows[0];
    res.send(landingHtml(item.title, item.description, item.thumbnailUrl || "", "video", contentId));
    return;
  }

  res.status(404).send(notFoundHtml());
});

function notFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="hi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>हमार किस्सा</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fef3c7}
.card{background:#fff;padding:2rem;border-radius:1rem;text-align:center;max-width:400px;margin:1rem;box-shadow:0 4px 20px rgba(0,0,0,0.1)}
h1{color:#b45309;margin:0 0 0.5rem}
p{color:#444;margin:0 0 1.5rem}
.btn{display:inline-block;background:#b45309;color:#fff;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none;font-weight:600}
</style></head>
<body>
<div class="card">
<h1>हमार किस्सा</h1>
<p>Content not found.</p>
<a class="btn" href="${PLAY_STORE_URL}">ऐप डाउनलोड करीं</a>
</div>
</body></html>`;
}

function landingHtml(title: string, description: string, thumbnail: string, type: string, id: number): string {
  const deepLink = `hamaarkissa://content/${type}/${id}`;
  return `<!DOCTYPE html>
<html lang="hi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title} - हमार किस्सा</title>
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${thumbnail}" />
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fef3c7}
.card{background:#fff;padding:2rem;border-radius:1rem;text-align:center;max-width:420px;margin:1rem;box-shadow:0 4px 20px rgba(0,0,0,0.1)}
.thumb{width:100%;max-width:280px;border-radius:0.75rem;margin-bottom:1rem;object-fit:cover}
h1{color:#b45309;margin:0 0 0.5rem;font-size:1.25rem}
p{color:#444;margin:0 0 1.5rem}
.btn{display:inline-block;background:#b45309;color:#fff;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none;font-weight:600;margin:0.25rem}
.btn-outline{background:transparent;color:#b45309;border:2px solid #b45309}
</style>
<script>
setTimeout(() => {
  window.location.href = "${deepLink}";
  setTimeout(() => {
    window.location.href = "${PLAY_STORE_URL}";
  }, 2000);
}, 100);
</script>
</head>
<body>
<div class="card">
${thumbnail ? `<img class="thumb" src="${thumbnail}" alt="" onerror="this.style.display='none'" />` : ""}
<h1>${title}</h1>
<p>${description || "हमार किस्सा ऐप में सुनहीं"}</p>
<a class="btn" href="${deepLink}">हमार किस्सा ऐप में खोलीं</a>
<br/>
<a class="btn btn-outline" href="${PLAY_STORE_URL}">ऐप डाउनलोड करीं</a>
</div>
</body></html>`;
}

export default router;
