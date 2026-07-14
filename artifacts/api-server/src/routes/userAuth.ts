import { Router } from "express";
import { eq, and, gt, or } from "drizzle-orm";
import { db, usersTable, otpVerificationsTable } from "@workspace/db";
import { sign, verify } from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const router = Router();

const JWT_SECRET = process.env["JWT_SECRET"] || "hamaar-kissa-jwt-secret";
const SMS_API_KEY = process.env["SMS_API_KEY"];
const GOOGLE_WEB_CLIENT_ID =
  process.env["GOOGLE_WEB_CLIENT_ID"] ??
  "980779060644-3imt0epjlh3i2ubshu0rj8tsi8do8i8c.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);

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

function parseProfileDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
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
  const { idToken } = req.body as {
    idToken?: string;
  };
  if (!idToken) {
    res.status(400).json({ error: "Google ID token required" });
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_WEB_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleId = payload?.sub;
    const email = payload?.email ?? null;

    if (!googleId || !email || payload?.email_verified !== true) {
      res.status(401).json({ error: "Google account could not be verified" });
      return;
    }

    let [user] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.googleId, googleId), eq(usersTable.email, email)))
      .limit(1);
    const isNewUser = !user;

    if (!user) {
      [user] = await db.insert(usersTable).values({
        name: payload.name ?? "",
        email,
        avatarUrl: payload.picture ?? null,
        authProvider: "google",
        googleId,
      }).returning();
    } else {
      [user] = await db.update(usersTable).set({
        googleId,
        name: payload.name || user.name,
        email,
        avatarUrl: payload.picture || user.avatarUrl,
        authProvider: "google",
        updatedAt: new Date(),
      }).where(eq(usersTable.id, user.id)).returning();
    }

    const token = generateToken(user.id);
    res.json({ token, user: toUserDto(user), isNewUser });
  } catch {
    res.status(401).json({ error: "Invalid Google ID token" });
  }
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



router.get("/auth/check-username", async (req,res)=>{

  const username=String(req.query.username ?? "")
    .trim()
    .toLowerCase();

  if(!username){
    res.json({available:false});
    return;
  }

  const existing=await db
    .select({id:usersTable.id})
    .from(usersTable)
    .where(eq(usersTable.username,username))
    .limit(1);

  res.json({
    available:existing.length===0
  });

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
  const {
    name,
    avatarUrl,
    username,
    dateOfBirth,
    age,
    phone,
    email,
  } = req.body as {
    name?: string;
    avatarUrl?: string;
    username?: string;
    dateOfBirth?: string;
    age?: number;
    phone?: string;
    email?: string;
  };

  if (username) {
    const existing = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, username));

    if (
      existing.length &&
      existing[0].id !== decoded.userId
    ) {
      return res.status(409).json({
        error:"Username already taken"
      });
    }
  }

  const [current] = await db.select()
    .from(usersTable)
    .where(eq(usersTable.id,decoded.userId));

  if (!current) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const parsedDateOfBirth = dateOfBirth ? parseProfileDate(dateOfBirth) : undefined;

  if (dateOfBirth && !parsedDateOfBirth) {
    res.status(400).json({ error: "Invalid date of birth" });
    return;
  }

  const [user]=await db.update(usersTable).set({

    name:name ?? undefined,

    avatarUrl:avatarUrl ?? undefined,

    username:username ?? undefined,

    dateOfBirth:parsedDateOfBirth,

    age:age ?? undefined,

    phone:
      current.authProvider==="phone"
        ? undefined
        : (phone ?? undefined),

    email:
      current.authProvider==="google"
        ? undefined
        : (email ?? undefined),

    updatedAt:new Date(),

  })
  .where(eq(usersTable.id,decoded.userId))
  .returning();
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
    username:user.username,
    dateOfBirth:user.dateOfBirth,
    age:user.age,
    createdAt: user.createdAt ? user.createdAt.toISOString() : null,
  };
}

export default router;
