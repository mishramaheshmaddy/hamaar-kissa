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

    // Single atomic upsert rather than select-then-insert-or-update: the
    // old version raced when two registration calls for the same token
    // landed close together (e.g. an effect firing twice on app start) —
    // both could see "no existing row" and both attempt an INSERT, and
    // the second hit `token`'s unique constraint and threw a 500. This
    // can't race: Postgres resolves the conflict atomically. Fields the
    // caller genuinely didn't send are simply left out of `set`, so
    // Postgres leaves the existing stored value untouched — same "keep
    // what's there if not provided" semantics as before, just race-free.
    await db
      .insert(pushTokensTable)
      .values({
        token,
        platform: platform ?? "android",
        phone: phone ?? null,
        notifyNewStories: notifyNewStories ?? true,
        notifyNewVideos: notifyNewVideos ?? true,
      })
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: {
          updatedAt: new Date(),
          ...(platform !== undefined ? { platform } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(notifyNewStories !== undefined ? { notifyNewStories } : {}),
          ...(notifyNewVideos !== undefined ? { notifyNewVideos } : {}),
        },
      });

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
