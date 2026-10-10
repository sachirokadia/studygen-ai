import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { authMiddleware, hashPassword, signToken, verifyPassword } from "../lib/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

function publicUser(u: { id: string; email: string; name: string; role: string }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const { email, password, name } = parsed.data;

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(users)
    .values({ email, passwordHash, name })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role });
  const user = inserted[0];
  if (!user) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.get("/me", authMiddleware, async (req, res) => {
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, req.userId ?? ""))
    .limit(1);
  const user = rows[0];
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: publicUser(user) });
});
