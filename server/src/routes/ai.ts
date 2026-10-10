import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { decks, flashcards, quizQuestions, quizzes } from "../db/schema.js";
import { authMiddleware } from "../lib/auth.js";
import {
  explainTopic,
  generateStudyPack,
  HttpError,
  isAiConfigured,
  tutorChat,
  type ChatMessage,
  type ExplainLevel,
} from "../lib/ai.js";
import { newCardState } from "../lib/sm2.js";

export const aiRouter = Router();
aiRouter.use(authMiddleware);

const studyPackSchema = z.object({
  title: z.string().min(1).max(300),
  sourceType: z.enum(["pdf", "youtube", "text", "topic"]),
  sourceName: z.string().max(300).optional(),
  content: z.string().min(20).max(120_000),
});

const explainSchema = z.object({
  topic: z.string().min(2).max(2000),
  level: z.enum(["eli5", "simple", "detailed"]).default("simple"),
});

const chatSchema = z.object({
  deckId: z.string().uuid().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof HttpError) return { status: err.status, message: err.message };
  return { status: 500, message: "AI request failed" };
}

/**
 * POST /study-pack — generate summary + flashcards + quiz from content,
 * then persist deck + cards + quiz. 503 when AI is not configured.
 */
aiRouter.post("/study-pack", async (req, res) => {
  const parsed = studyPackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  if (!isAiConfigured()) {
    res.status(503).json({ error: "AI not configured — set AI_API_KEY to enable AI features." });
    return;
  }

  const userId = req.userId ?? "";
  const { title, sourceType, sourceName, content } = parsed.data;

  // Mark a generating deck first so the client can poll/show progress.
  const deckRows = await db
    .insert(decks)
    .values({ userId, title, sourceType, sourceName: sourceName ?? null, status: "generating" })
    .returning();
  const deck = deckRows[0];
  if (!deck) {
    res.status(500).json({ error: "Failed to create deck" });
    return;
  }

  try {
    const pack = await generateStudyPack(title, sourceType, content);
    const state = newCardState();

    if (pack.flashcards.length > 0) {
      await db.insert(flashcards).values(
        pack.flashcards.map((c, i) => ({
          userId,
          deckId: deck.id,
          front: c.front,
          back: c.back,
          orderIndex: i,
          ...state,
        })),
      );
    }

    let quizId: string | null = null;
    if (pack.quiz.length > 0) {
      const quizRows = await db
        .insert(quizzes)
        .values({ userId, deckId: deck.id, title: `${title} — Quiz` })
        .returning({ id: quizzes.id });
      quizId = quizRows[0]?.id ?? null;
      if (quizId) {
        await db.insert(quizQuestions).values(
          pack.quiz.map((q, i) => ({
            quizId: quizId as string,
            question: q.question,
            options: [...q.options],
            correctIndex: Math.min(Math.max(q.correct, 0), 3),
            explanation: q.explanation ?? "",
            orderIndex: i,
          })),
        );
      }
    }

    const updated = await db
      .update(decks)
      .set({ summary: pack.summary, status: "ready" })
      .where(eq(decks.id, deck.id))
      .returning();

    res.status(201).json({
      deck: updated[0],
      summary: pack.summary,
      flashcardsCreated: pack.flashcards.length,
      quizId,
      questionsCreated: pack.quiz.length,
    });
  } catch (err) {
    await db.update(decks).set({ status: "failed" }).where(eq(decks.id, deck.id));
    const { status, message } = toHttpError(err);
    res.status(status).json({ error: message, deckId: deck.id });
  }
});

/** POST /explain — ELI5/simple/detailed explanation of a topic. */
aiRouter.post("/explain", async (req, res) => {
  const parsed = explainSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  if (!isAiConfigured()) {
    res.status(503).json({ error: "AI not configured — set AI_API_KEY to enable AI features." });
    return;
  }
  try {
    const explanation = await explainTopic(parsed.data.topic, parsed.data.level as ExplainLevel);
    res.json({ explanation, level: parsed.data.level });
  } catch (err) {
    const { status, message } = toHttpError(err);
    res.status(status).json({ error: message });
  }
});

/** POST /chat — tutor chat, optionally scoped to a deck's summary. */
aiRouter.post("/chat", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  if (!isAiConfigured()) {
    res.status(503).json({ error: "AI not configured — set AI_API_KEY to enable AI features." });
    return;
  }

  const userId = req.userId ?? "";
  let summary = "";
  if (parsed.data.deckId) {
    const rows = await db
      .select({ summary: decks.summary })
      .from(decks)
      .where(and(eq(decks.id, parsed.data.deckId), eq(decks.userId, userId)))
      .limit(1);
    summary = rows[0]?.summary ?? "";
  }

  try {
    const reply = await tutorChat(summary, parsed.data.messages as ChatMessage[]);
    res.json({ reply });
  } catch (err) {
    const { status, message } = toHttpError(err);
    res.status(status).json({ error: message });
  }
});

/**
 * GET /youtube-transcript?url= — best-effort transcript fetch.
 * Extracts the video id, fetches captions, joins into plain text.
 */
aiRouter.get("/youtube-transcript", async (req, res) => {
  const url = String(req.query.url ?? "");
  const id = extractYouTubeId(url);
  if (!id) {
    res.status(400).json({ error: "Invalid YouTube URL" });
    return;
  }
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    const parts = await YoutubeTranscript.fetchTranscript(id);
    const text = parts
      .map((p: { text: string }) => p.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60_000);
    if (!text) {
      res.status(404).json({ error: "No transcript available for this video" });
      return;
    }
    res.json({ text, videoId: id });
  } catch {
    res.status(502).json({ error: "Failed to fetch transcript (captions may be disabled)" });
  }
});

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1).split("/")[0];
      return id && id.length >= 6 ? id : null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = u.pathname.match(/^\/(embed|shorts)\/([\w-]{6,})/);
      if (m?.[2]) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}
