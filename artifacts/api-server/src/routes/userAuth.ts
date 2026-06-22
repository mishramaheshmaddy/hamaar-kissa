import { Router } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, usersTable, otpVerificationsTable } from "@workspace/db";
import { sign, verify } from "jsonwebtoken";

const router = Router();

const JWT_SECRET = process.env["JWT_SECRET"] || "hamaar-kissa-jwt-secret";
const SMS_API_KEY = process.env["SMS_API_KEY"];

function generateToken(userId: number): string {
  return sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyUserToken(token: string): { userId: number } | null {
  try {
    const decoded = verify(token, JWT_SECRET) as { userId: number };
    return decoded;
  } catch {
    return null;
  }
}

export async function requireUserAuth(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);
  const decoded = verifyUserToken(token);
  if (!decoded) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  (req as unknown as Record<string, unknown>).user = user;
  next();
}

router.post("/auth/send-otp", async (req, res) => {
  const { phone } = req.body as { phone?: string };
  if (!phone || !phone.match(/^\d{10}$/)) {
    res.status(400).json({ error: "Valid 10-digit phone number required" });
    return;
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(otpVerificationsTable).values({
    phone,
    otpCode: otp,
    expiresAt,
  });

  if (SMS_API_KEY) {
    try {
      await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: SMS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variables_values: otp,
          route: "otp",
          numbers: phone,
        }),
      });
    } catch {
      // silently fail SMS; still return OTP in dev
    }
  }

  res.json({ success: true, message: "OTP sent", otp: SMS_API_KEY ? undefined : otp });
});

router.post("/auth/verify-otp", async (req, res) => {
  const { phone, otp } = req.body as { phone?: string; otp?: string };
  if (!phone || !otp) {
    res.status(400).json({ error: "Phone and OTP required" });
    return;
  }

  const [record] = await db
    .select()
    .from(otpVerificationsTable)
    .where(
      and(
        eq(otpVerificationsTable.phone, phone),
        eq(otpVerificationsTable.otpCode, otp),
        eq(otpVerificationsTable.isUsed, false),
        gt(otpVerificationsTable.expiresAt, new Date())
      )
    )
    .orderBy(otpVerificationsTable.createdAt)
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "Invalid or expired OTP" });
    return;
  }

  await db.update(otpVerificationsTable).set({ isUsed: true }).where(eq(otpVerificationsTable.id, record.id));

  let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  const isNewUser = !user;
  if (!user) {
    const [newUser] = await db.insert(usersTable).values({
      phone,
      name: "",
      authProvider: "phone",
    }).returning();
    user = newUser;
  }

  const token = generateToken(user.id);
  res.json({ token, user: toUserDto(user), isNewUser });
});

router.post("/auth/google", async (req, res) => {
  const { idToken, name, email, photo } = req.body as {
    idToken?: string;
    name?: string;
    email?: string;
    photo?: string;
  };
  if (!idToken) {
    res.status(400).json({ error: "Google ID token required" });
    return;
  }

  let googleId = "";
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64").toString());
    googleId = payload.sub || payload.user_id || "";
  } catch {
    res.status(400).json({ error: "Invalid token" });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, googleId));
  const isNewUser = !user;
  if (!user) {
    const [newUser] = await db.insert(usersTable).values({
      name: name || "",
      email: email || null,
      avatarUrl: photo || null,
      authProvider: "google",
      googleId,
    }).returning();
    user = newUser;
  } else if (name || email || photo) {
    const [updated] = await db.update(usersTable).set({
      name: name || user.name,
      email: email || user.email,
      avatarUrl: photo || user.avatarUrl,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, user.id)).returning();
    user = updated;
  }

  const token = generateToken(user.id);
  res.json({ token, user: toUserDto(user), isNewUser });
});

router.get("/auth/me", async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    next(); // Let admin auth router handle session-based auth
    return;
  }
  const token = auth.slice(7);
  const decoded = verifyUserToken(token);
  if (!decoded) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(toUserDto(user));
});

router.put("/auth/profile", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);
  const decoded = verifyUserToken(token);
  if (!decoded) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const { name, avatarUrl } = req.body as { name?: string; avatarUrl?: string };
  const [user] = await db.update(usersTable).set({
    name: name ?? undefined,
    avatarUrl: avatarUrl ?? undefined,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, decoded.userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(toUserDto(user));
});

function toUserDto(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider,
    createdAt: user.createdAt ? user.createdAt.toISOString() : null,
  };
}

export default router;
