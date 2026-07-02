import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET = process.env["JWT_SECRET"] ?? "hamaar-kissa-secret";

async function getAdmin() {
  const admin = await import("firebase-admin/app");
  const auth = await import("firebase-admin/auth");
  if (admin.getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env["FIREBASE_SERVICE_ACCOUNT"] ?? "{}");
    admin.initializeApp({
      credential: admin.cert(serviceAccount as any),
    });
  }
  return { admin, auth };
}

router.post("/auth/firebase", async (req, res) => {
  try {
    const { firebaseToken } = req.body as { firebaseToken?: string };
    if (!firebaseToken) {
      res.status(400).json({ error: "firebaseToken required" });
      return;
    }

    const { auth } = await getAdmin();
    const decoded = await auth.getAuth().verifyIdToken(firebaseToken);
    const phone = decoded.phone_number ?? null;
    const email = decoded.email ?? null;
    const name = decoded.name ?? (phone ? phone : (email ?? "User"));
    const provider = decoded.firebase.sign_in_provider;

    let user = null;
    if (phone) {
      const existing = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
      user = existing[0] ?? null;
    } else if (email) {
      const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
      user = existing[0] ?? null;
    }

    const isNewUser = !user;

    if (!user) {
      const inserted = await db.insert(usersTable).values({
        name,
        email,
        phone,
        authProvider: provider,
        avatarUrl: decoded.picture ?? null,
      }).returning();
      user = inserted[0];
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        authProvider: user.authProvider,
        createdAt: user.createdAt,
        location: user.location ?? null,
      },
      isNewUser,
    });
  } catch (err) {
    console.error("Firebase auth error:", err);
    res.status(401).json({ error: "Invalid Firebase token" });
  }
});

export default router;
