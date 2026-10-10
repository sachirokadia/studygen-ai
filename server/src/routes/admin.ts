import { Router } from "express";
import { count } from "drizzle-orm";
import { db } from "../db/client.js";
import { decks, flashcards, users } from "../db/schema.js";
import { adminMiddleware, authMiddleware } from "../lib/auth.js";

export const adminRouter = Router();
adminRouter.use(authMiddleware, adminMiddleware);

/** GET /stats → {users, decks, cards} — admin only. */
adminRouter.get("/stats", async (_req, res) => {
  const [u, d, c] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(decks),
    db.select({ n: count() }).from(flashcards),
  ]);
  res.json({
    users: Number(u[0]?.n ?? 0),
    decks: Number(d[0]?.n ?? 0),
    cards: Number(c[0]?.n ?? 0),
  });
});
