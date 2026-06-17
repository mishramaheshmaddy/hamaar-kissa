import { Router } from "express";

declare module "express-session" {
  interface SessionData {
    adminEmail?: string;
  }
}

const router = Router();

const ADMIN_EMAIL = process.env["ADMIN_EMAIL"] ?? "mahesh.gkp@gmail.com";
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] ?? "abcd@1234";

router.post("/auth/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  if (email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  req.session.adminEmail = ADMIN_EMAIL;
  res.json({ email: ADMIN_EMAIL });
});

router.get("/auth/me", (req, res) => {
  if (!req.session.adminEmail) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ email: req.session.adminEmail });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
