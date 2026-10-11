import { Router } from "express";
import { and, asc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { decks, flashcards, reviewLogs } from "../db/schema.js";
import { authMiddleware } from "../lib/auth.js";
import { newCardState, sm2 } from "../lib/sm2.js";

export const flashcardsRouter = Router();
flashcardsRouter.use(authMiddleware);

const createCardSchema = z.object({
  deckId: z.string().uuid(),
  front: z.string().min(1).max(5000),
  back: z.string().min(1).max(5000),
});

const updateCardSchema = z.object({
  front: z.string().min(1).max(5000).optional(),
  back: z.string().min(1).max(5000).optional(),
});

const reviewSchema = z.object({
  cardId: z.string().uuid(),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

async function ownDeck(deckId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .limit(1);
  return Boolean(rows[0]);
}

/** GET /due — cards due now, ordered by dueAt. ?limit= (default 50), ?deckId= for deck-scoped review */
flashcardsRouter.get("/due", async (req, res) => {
  const userId = req.userId ?? "";
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 500);
  // Fix 9: optional deckId filter for deck-scoped review.
  const deckId = typeof req.query.deckId === "string" && req.query.deckId.length > 0 ? req.query.deckId : null;
  const conditions = [eq(flashcards.userId, userId), lte(flashcards.dueAt, new Date())];
  if (deckId) conditions.push(eq(flashcards.deckId, deckId));
  const rows = await db
    .select()
    .from(flashcards)
    .where(and(...conditions))
    .orderBy(asc(flashcards.dueAt))
    .limit(limit);
  res.json({ cards: rows });
});

/** POST /review — grade a card, apply SM-2, log the review. */
flashcardsRouter.post("/review", async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const userId = req.userId ?? "";
  const { cardId, grade } = parsed.data;

  const rows = await db
    .select()
    .from(flashcards)
    .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, userId)))
    .limit(1);
  const card = rows[0];
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const next = sm2(
    { easiness: card.easiness, interval: card.interval, repetitions: card.repetitions },
    grade,
  );

  const updated = await db
    .update(flashcards)
    .set({
      easiness: next.easiness,
      interval: next.interval,
      repetitions: next.repetitions,
      dueAt: next.dueAt,
    })
    .where(eq(flashcards.id, cardId))
    .returning();

  await db.insert(reviewLogs).values({ userId, cardId, grade });

  res.json({ card: updated[0] });
});

/** POST / — create a card in an owned deck. */
flashcardsRouter.post("/", async (req, res) => {
  const parsed = createCardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const userId = req.userId ?? "";
  if (!(await ownDeck(parsed.data.deckId, userId))) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }
  const state = newCardState();
  const inserted = await db
    .insert(flashcards)
    .values({
      userId,
      deckId: parsed.data.deckId,
      front: parsed.data.front,
      back: parsed.data.back,
      ...state,
    })
    .returning();
  res.status(201).json({ card: inserted[0] });
});

/** PATCH /:id — edit front/back. */
flashcardsRouter.patch("/:id", async (req, res) => {
  const parsed = updateCardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const updated = await db
    .update(flashcards)
    .set(parsed.data)
    .where(and(eq(flashcards.id, req.params.id ?? ""), eq(flashcards.userId, req.userId ?? "")))
    .returning();
  const card = updated[0];
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  res.json({ card });
});

/** DELETE /:id */
flashcardsRouter.delete("/:id", async (req, res) => {
  const deleted = await db
    .delete(flashcards)
    .where(and(eq(flashcards.id, req.params.id ?? ""), eq(flashcards.userId, req.userId ?? "")))
    .returning({ id: flashcards.id });
  if (!deleted[0]) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  res.json({ ok: true });
});
