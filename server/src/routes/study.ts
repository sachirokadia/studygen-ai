import { Router } from "express";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { decks, flashcards, focusSessions, quizAttempts, reviewLogs } from "../db/schema.js";
import { authMiddleware } from "../lib/auth.js";

export const studyRouter = Router();
studyRouter.use(authMiddleware);

const focusSchema = z.object({
  minutes: z.number().int().min(1).max(480),
});

const XP_PER_MINUTE = 2;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** GET /today → {dueCount, decksCount, focusMinutesToday, xpToday} */
studyRouter.get("/today", async (req, res) => {
  const userId = req.userId ?? "";
  const today = startOfToday();

  const [dueRows, deckRows, focusRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(flashcards)
      .where(and(eq(flashcards.userId, userId), lte(flashcards.dueAt, new Date()))),
    db.select({ n: count() }).from(decks).where(eq(decks.userId, userId)),
    db
      .select({
        minutes: sql<number>`coalesce(sum(${focusSessions.minutes}), 0)`,
        xp: sql<number>`coalesce(sum(${focusSessions.xp}), 0)`,
      })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, userId), gte(focusSessions.completedAt, today))),
  ]);

  res.json({
    dueCount: Number(dueRows[0]?.n ?? 0),
    decksCount: Number(deckRows[0]?.n ?? 0),
    focusMinutesToday: Number(focusRows[0]?.minutes ?? 0),
    xpToday: Number(focusRows[0]?.xp ?? 0),
  });
});

/** POST /focus {minutes} → record a completed session, award XP. */
studyRouter.post("/focus", async (req, res) => {
  const parsed = focusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const xp = parsed.data.minutes * XP_PER_MINUTE;
  const inserted = await db
    .insert(focusSessions)
    .values({ userId: req.userId ?? "", minutes: parsed.data.minutes, xp })
    .returning();
  res.status(201).json({ session: inserted[0], xp });
});

/**
 * GET /heatmap → [{date, count}] for the last 16 weeks (112 days).
 * count = reviews + focus sessions completed that day.
 */
studyRouter.get("/heatmap", async (req, res) => {
  const userId = req.userId ?? "";
  const days = 112;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [reviews, sessions] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${reviewLogs.reviewedAt}, 'YYYY-MM-DD')`,
        n: count(),
      })
      .from(reviewLogs)
      .where(and(eq(reviewLogs.userId, userId), gte(reviewLogs.reviewedAt, since)))
      .groupBy(sql`to_char(${reviewLogs.reviewedAt}, 'YYYY-MM-DD')`),
    db
      .select({
        day: sql<string>`to_char(${focusSessions.completedAt}, 'YYYY-MM-DD')`,
        n: count(),
      })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, userId), gte(focusSessions.completedAt, since)))
      .groupBy(sql`to_char(${focusSessions.completedAt}, 'YYYY-MM-DD')`),
  ]);

  const totals = new Map<string, number>();
  for (const r of [...reviews, ...sessions]) {
    totals.set(r.day, (totals.get(r.day) ?? 0) + Number(r.n));
  }

  const out: Array<{ date: string; count: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: totals.get(key) ?? 0 });
  }
  res.json({ heatmap: out });
});

export type Recommendation = {
  type: "review" | "weak-deck" | "focus" | "start";
  title: string;
  reason: string;
  link: string;
};

/**
 * GET /recommendations → simple heuristic suggestions:
 * - due cards → review
 * - decks with low recent quiz scores → weak-deck
 * - no focus today → focus nudge
 * - no decks at all → start
 */
studyRouter.get("/recommendations", async (req, res) => {
  const userId = req.userId ?? "";
  const recs: Recommendation[] = [];

  const dueRows = await db
    .select({ n: count() })
    .from(flashcards)
    .where(and(eq(flashcards.userId, userId), lte(flashcards.dueAt, new Date())));
  const dueCount = Number(dueRows[0]?.n ?? 0);
  if (dueCount > 0) {
    recs.push({
      type: "review",
      title: `Review ${dueCount} due card${dueCount === 1 ? "" : "s"}`,
      reason: "Spaced repetition works best when you clear due cards daily.",
      link: "/review",
    });
  }

  // Weak decks: average score < 70% across recent attempts (last 20).
  const attempts = await db
    .select({
      quizId: quizAttempts.quizId,
      score: quizAttempts.score,
      total: quizAttempts.total,
    })
    .from(quizAttempts)
    .where(eq(quizAttempts.userId, userId));
  if (attempts.length >= 3) {
    const byQuiz = new Map<string, { s: number; t: number }>();
    for (const a of attempts.slice(-20)) {
      const cur = byQuiz.get(a.quizId) ?? { s: 0, t: 0 };
      cur.s += a.score;
      cur.t += a.total;
      byQuiz.set(a.quizId, cur);
    }
    let worst: { quizId: string; pct: number } | null = null;
    for (const [quizId, v] of byQuiz) {
      if (v.t === 0) continue;
      const pct = v.s / v.t;
      if (pct < 0.7 && (!worst || pct < worst.pct)) worst = { quizId, pct };
    }
    if (worst) {
      recs.push({
        type: "weak-deck",
        title: `Revisit a weak quiz (${Math.round(worst.pct * 100)}% avg)`,
        reason: "Missed questions were added to your flashcards — review them.",
        link: `/quiz/${worst.quizId}`,
      });
    }
  }

  const today = startOfToday();
  const focusRows = await db
    .select({ n: count() })
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), gte(focusSessions.completedAt, today)));
  if (Number(focusRows[0]?.n ?? 0) === 0) {
    recs.push({
      type: "focus",
      title: "Start a 25-minute focus session",
      reason: "No focus time logged today yet.",
      link: "/",
    });
  }

  if (recs.length === 0) {
    const deckRows = await db
      .select({ n: count() })
      .from(decks)
      .where(eq(decks.userId, userId));
    if (Number(deckRows[0]?.n ?? 0) === 0) {
      recs.push({
        type: "start",
        title: "Create your first deck",
        reason: "Upload a PDF, paste a YouTube link, or type a topic to begin.",
        link: "/decks",
      });
    }
  }

  res.json({ recommendations: recs });
});
