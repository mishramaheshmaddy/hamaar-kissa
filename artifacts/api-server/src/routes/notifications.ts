import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  pushTokensTable,
  notificationSettingsTable,
  scheduledNotificationsTable,
} from "@workspace/db";
import { requireAdmin } from "./auth";
import { sendPushToTokens, resolveTokensForPhones } from "../lib/push";

const router = Router();

function buildDeepLinkData(contentType?: string | null, contentId?: number | null) {
  if (!contentType || !contentId) return undefined;
  return { type: contentType, id: String(contentId) };
}

// ---------------------------------------------------------------------
// Daily cycle (recurring, at most once every 24h while enabled)
// ---------------------------------------------------------------------

async function getOrCreateSettingsRow() {
  const [existing] = await db.select().from(notificationSettingsTable).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(notificationSettingsTable).values({}).returning();
  return created;
}

router.get("/admin/notifications/settings", requireAdmin, async (_req, res) => {
  try {
    const settings = await getOrCreateSettingsRow();
    res.json(settings);
  } catch (e) {
    console.error("GET /admin/notifications/settings error:", e);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

router.put("/admin/notifications/settings", requireAdmin, async (req, res) => {
  try {
    const { enabled, title, body, contentType, contentId } = req.body as {
      enabled?: boolean;
      title?: string;
      body?: string;
      contentType?: string | null;
      contentId?: number | null;
    };

    const current = await getOrCreateSettingsRow();
    const turningOn = enabled === true && !current.dailyCycleEnabled;

    if (enabled === true && (!title?.trim() || !body?.trim())) {
      res.status(400).json({ error: "title and body are required to enable the daily cycle" });
      return;
    }

    const [updated] = await db
      .update(notificationSettingsTable)
      .set({
        dailyCycleEnabled: enabled ?? current.dailyCycleEnabled,
        dailyCycleTitle: title !== undefined ? title.trim() : current.dailyCycleTitle,
        dailyCycleBody: body !== undefined ? body.trim() : current.dailyCycleBody,
        dailyCycleContentType: contentType !== undefined ? contentType : current.dailyCycleContentType,
        dailyCycleContentId: contentId !== undefined ? contentId : current.dailyCycleContentId,
        // Turning the cycle on (from off) resets the clock so the first
        // send happens on the next scheduler tick (~5 min), then every
        // 24h after that. Editing the message while already on, or
        // turning it off, doesn't touch the timer.
        ...(turningOn ? { dailyCycleLastSentAt: null } : {}),
      })
      .where(eq(notificationSettingsTable.id, current.id))
      .returning();

    res.json(updated);
  } catch (e) {
    console.error("PUT /admin/notifications/settings error:", e);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ---------------------------------------------------------------------
// Manual notifications — immediate ("Push Now") or scheduled for later.
// Neither repeats; each row is a one-time send.
// ---------------------------------------------------------------------

router.get("/admin/notifications/scheduled", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(scheduledNotificationsTable)
      .orderBy(desc(scheduledNotificationsTable.scheduledAt))
      .limit(50);
    res.json(rows);
  } catch (e) {
    console.error("GET /admin/notifications/scheduled error:", e);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

// Sends immediately and records it in the same table (status "sent") so
// it shows up alongside scheduled ones in the CMS history list.
router.post("/admin/notifications/broadcast", requireAdmin, async (req, res) => {
  try {
    const { title, body, contentType, contentId, phones } = req.body as {
      title?: string;
      body?: string;
      contentType?: string | null;
      contentId?: number | null;
      phones?: string[];
    };
    if (!title?.trim() || !body?.trim()) {
      res.status(400).json({ error: "title and body are required" });
      return;
    }

    let tokens: string[];
    let matched: string[] = [];
    let unmatched: string[] = [];
    if (phones && phones.length > 0) {
      const resolved = await resolveTokensForPhones(phones);
      tokens = resolved.tokens;
      matched = resolved.matched;
      unmatched = resolved.unmatched;
    } else {
      const rows = await db.select({ token: pushTokensTable.token }).from(pushTokensTable);
      tokens = rows.map((r) => r.token);
    }

    const result = tokens.length
      ? await sendPushToTokens(tokens, title.trim(), body.trim(), buildDeepLinkData(contentType, contentId))
      : { sent: 0, failed: 0 };

    const [record] = await db
      .insert(scheduledNotificationsTable)
      .values({
        title: title.trim(),
        body: body.trim(),
        contentType: contentType ?? null,
        contentId: contentId ?? null,
        targetPhones: phones && phones.length > 0 ? JSON.stringify(phones) : null,
        scheduledAt: new Date(),
        status: "sent",
        sentAt: new Date(),
      })
      .returning();

    res.json({ ok: true, recipients: tokens.length, matched, unmatched, ...result, record });
  } catch (e) {
    console.error("POST /admin/notifications/broadcast error:", e);
    res.status(500).json({ error: "Failed to send broadcast" });
  }
});

// Queues a one-time notification for a future date/time — the scheduler
// (checks every 5 min) will send it once scheduledAt has passed.
router.post("/admin/notifications/scheduled", requireAdmin, async (req, res) => {
  try {
    const { title, body, contentType, contentId, scheduledAt, phones } = req.body as {
      title?: string;
      body?: string;
      contentType?: string | null;
      contentId?: number | null;
      scheduledAt?: string;
      phones?: string[];
    };
    if (!title?.trim() || !body?.trim() || !scheduledAt) {
      res.status(400).json({ error: "title, body, and scheduledAt are required" });
      return;
    }
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
      res.status(400).json({ error: "scheduledAt is not a valid date" });
      return;
    }

    const [record] = await db
      .insert(scheduledNotificationsTable)
      .values({
        title: title.trim(),
        body: body.trim(),
        contentType: contentType ?? null,
        contentId: contentId ?? null,
        targetPhones: phones && phones.length > 0 ? JSON.stringify(phones) : null,
        scheduledAt: when,
        status: "pending",
      })
      .returning();

    res.status(201).json(record);
  } catch (e) {
    console.error("POST /admin/notifications/scheduled error:", e);
    res.status(500).json({ error: "Failed to schedule notification" });
  }
});

// Cancels a pending scheduled notification before it goes out.
router.delete("/admin/notifications/scheduled/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .update(scheduledNotificationsTable)
      .set({ status: "cancelled" })
      .where(eq(scheduledNotificationsTable.id, id));
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /admin/notifications/scheduled/:id error:", e);
    res.status(500).json({ error: "Failed to cancel notification" });
  }
});

export default router;
