import { Router } from "express";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { decks, flashcards, quizzes } from "../db/schema.js";
import { authMiddleware } from "../lib/auth.js";

export const decksRouter = Router();
decksRouter.use(authMiddleware);

const createDeckSchema = z.object({
  title: z.string().min(1).max(300),
  sourceType: z.enum(["pdf", "youtube", "text", "topic"]),
  sourceName: z.string().max(300).optional(),
  summary: z.string().max(60_000).optional(),
});

const updateDeckSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  sourceName: z.string().max(300).nullable().optional(),
  summary: z.string().max(60_000).nullable().optional(),
  status: z.enum(["ready", "generating", "failed"]).optional(),
});

/** GET / — list user's decks with card counts. */
decksRouter.get("/", async (req, res) => {
  const userId = req.userId ?? "";
  const rows = await db
    .select({
      id: decks.id,
      title: decks.title,
      sourceType: decks.sourceType,
      sourceName: decks.sourceName,
      summary: decks.summary,
      status: decks.status,
      createdAt: decks.createdAt,
      cardCount: count(flashcards.id),
    })
    .from(decks)
    .leftJoin(flashcards, eq(flashcards.deckId, decks.id))
    .where(eq(decks.userId, userId))
    .groupBy(decks.id)
    .orderBy(decks.createdAt);
  res.json({ decks: rows });
});

/** POST / — create a deck. */
decksRouter.post("/", async (req, res) => {
  const parsed = createDeckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const inserted = await db
    .insert(decks)
    .values({ userId: req.userId ?? "", ...parsed.data })
    .returning();
  res.status(201).json({ deck: inserted[0] });
});

/** GET /:id — deck + flashcards + quizzes. */
decksRouter.get("/:id", async (req, res) => {
  const userId = req.userId ?? "";
  const deckRows = await db
    .select()
    .from(decks)
    .where(and(eq(decks.id, req.params.id ?? ""), eq(decks.userId, userId)))
    .limit(1);
  const deck = deckRows[0];
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }
  const [cards, deckQuizzes] = await Promise.all([
    db
      .select()
      .from(flashcards)
      .where(eq(flashcards.deckId, deck.id))
      .orderBy(flashcards.orderIndex),
    db.select().from(quizzes).where(eq(quizzes.deckId, deck.id)).orderBy(quizzes.createdAt),
  ]);
  res.json({ deck, flashcards: cards, quizzes: deckQuizzes });
});

/** PATCH /:id — update deck fields. */
decksRouter.patch("/:id", async (req, res) => {
  const parsed = updateDeckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const updated = await db
    .update(decks)
    .set(parsed.data)
    .where(and(eq(decks.id, req.params.id ?? ""), eq(decks.userId, req.userId ?? "")))
    .returning();
  const deck = updated[0];
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }
  res.json({ deck });
});

/** DELETE /:id — delete deck (cascades to cards/quizzes). */
decksRouter.delete("/:id", async (req, res) => {
  const deleted = await db
    .delete(decks)
    .where(and(eq(decks.id, req.params.id ?? ""), eq(decks.userId, req.userId ?? "")))
    .returning({ id: decks.id });
  if (!deleted[0]) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }
  res.json({ ok: true });
});
