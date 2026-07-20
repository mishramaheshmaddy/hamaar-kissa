import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, pushTokensTable } from "@workspace/db";

const router = Router();

// Register or update a device's push token + notification preferences.
// No auth required — mirrors the existing notification settings screen,
// which already works without login.
router.post("/push-tokens", async (req, res) => {
  try {
    const { token, platform, phone, notifyNewStories, notifyNewVideos } = req.body as {
      token?: string;
      platform?: string;
      phone?: string | null;
      notifyNewStories?: boolean;
      notifyNewVideos?: boolean;
    };
    if (!token) {
      res.status(400).json({ error: "token required" });
      return;
    }

    const existing = await db.select().from(pushTokensTable).where(eq(pushTokensTable.token, token));
    if (existing.length > 0) {
      await db
        .update(pushTokensTable)
        .set({
          platform: platform ?? existing[0].platform,
          phone: phone !== undefined ? phone : existing[0].phone,
          notifyNewStories: notifyNewStories ?? existing[0].notifyNewStories,
          notifyNewVideos: notifyNewVideos ?? existing[0].notifyNewVideos,
        })
        .where(eq(pushTokensTable.token, token));
    } else {
      await db.insert(pushTokensTable).values({
        token,
        platform: platform ?? "android",
        phone: phone ?? null,
        notifyNewStories: notifyNewStories ?? true,
        notifyNewVideos: notifyNewVideos ?? true,
      });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /push-tokens error:", e);
    res.status(500).json({ error: "Failed to save push token" });
  }
});

// Called when the user turns the master notification toggle off, so this
// device stops receiving anything at all.
router.delete("/push-tokens/:token", async (req, res) => {
  try {
    await db.delete(pushTokensTable).where(eq(pushTokensTable.token, req.params.token));
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /push-tokens error:", e);
    res.status(500).json({ error: "Failed to remove push token" });
  }
});

export default router;
