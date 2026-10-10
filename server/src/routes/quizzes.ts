import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { decks, flashcards, quizAttempts, quizQuestions, quizzes } from "../db/schema.js";
import { authMiddleware } from "../lib/auth.js";
import { newCardState } from "../lib/sm2.js";

export const quizzesRouter = Router();
quizzesRouter.use(authMiddleware);

const createQuizSchema = z.object({
  deckId: z.string().uuid(),
  title: z.string().min(1).max(300).optional(),
  timeLimitS: z.number().int().min(10).max(7200).optional(),
  questions: z
    .array(
      z.object({
        question: z.string().min(1).max(5000),
        options: z.array(z.string().min(1).max(2000)).length(4),
        correct: z.number().int().min(0).max(3),
        explanation: z.string().max(5000).default(""),
      }),
    )
    .min(1)
    .max(50)
    .optional(),
});

const attemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        selected: z.number().int().min(0).max(3),
      }),
    )
    .min(1),
});

async function ownQuiz(quizId: string, userId: string) {
  const rows = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/** POST / — create a quiz (questions may be supplied or added later). */
quizzesRouter.post("/", async (req, res) => {
  const parsed = createQuizSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const userId = req.userId ?? "";
  const { deckId, title, timeLimitS, questions } = parsed.data;

  const deckRows = await db
    .select({ id: decks.id, title: decks.title })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
    .limit(1);
  const deck = deckRows[0];
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const inserted = await db
    .insert(quizzes)
    .values({
      userId,
      deckId,
      title: title ?? `${deck.title} — Quiz`,
      timeLimitS: timeLimitS ?? null,
    })
    .returning();
  const quiz = inserted[0];
  if (!quiz) {
    res.status(500).json({ error: "Failed to create quiz" });
    return;
  }

  if (questions && questions.length > 0) {
    await db.insert(quizQuestions).values(
      questions.map((q, i) => ({
        quizId: quiz.id,
        question: q.question,
        options: q.options,
        correctIndex: q.correct,
        explanation: q.explanation,
        orderIndex: i,
      })),
    );
  }

  const qs = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(asc(quizQuestions.orderIndex));
  res.status(201).json({ quiz, questions: qs });
});

/** GET /:id — quiz with questions (correctIndex included; client hides until review). */
quizzesRouter.get("/:id", async (req, res) => {
  const quiz = await ownQuiz(req.params.id ?? "", req.userId ?? "");
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }
  const qs = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(asc(quizQuestions.orderIndex));
  res.json({ quiz, questions: qs });
});

/**
 * POST /:id/attempt — grade answers, persist attempt, auto-create flashcards
 * for missed questions (deduped by exact front match within the deck).
 */
quizzesRouter.post("/:id/attempt", async (req, res) => {
  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const userId = req.userId ?? "";
  const quiz = await ownQuiz(req.params.id ?? "", userId);
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  const qs = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(asc(quizQuestions.orderIndex));
  const byId = new Map(qs.map((q) => [q.id, q]));

  let score = 0;
  const missed: typeof qs = [];
  for (const a of parsed.data.answers) {
    const q = byId.get(a.questionId);
    if (!q) continue;
    if (a.selected === q.correctIndex) {
      score += 1;
    } else {
      missed.push(q);
    }
  }
  const total = parsed.data.answers.length;

  const inserted = await db
    .insert(quizAttempts)
    .values({ quizId: quiz.id, userId, score, total, answers: parsed.data.answers })
    .returning({ id: quizAttempts.id });
  const attemptId = inserted[0]?.id;

  // Missed → flashcards. Dedupe: skip if a card with the same front exists.
  let cardsCreated = 0;
  if (missed.length > 0) {
    const existing = await db
      .select({ front: flashcards.front })
      .from(flashcards)
      .where(and(eq(flashcards.deckId, quiz.deckId), eq(flashcards.userId, userId)));
    const fronts = new Set(existing.map((c) => c.front));
    const state = newCardState();
    for (const q of missed) {
      if (fronts.has(q.question)) continue;
      const correctOption = q.options[q.correctIndex] ?? "";
      const back = q.explanation
        ? `${correctOption}\n\n${q.explanation}`
        : correctOption;
      await db.insert(flashcards).values({
        userId,
        deckId: quiz.deckId,
        front: q.question,
        back,
        ...state,
      });
      fronts.add(q.question);
      cardsCreated += 1;
    }
  }

  res.status(201).json({ score, total, attemptId, cardsCreated });
});

/** GET /:id/attempts — attempt history for a quiz. */
quizzesRouter.get("/:id/attempts", async (req, res) => {
  const quiz = await ownQuiz(req.params.id ?? "", req.userId ?? "");
  if (!quiz) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }
  const attempts = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.quizId, quiz.id))
    .orderBy(quizAttempts.completedAt);
  res.json({ attempts });
});
