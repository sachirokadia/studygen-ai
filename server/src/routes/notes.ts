import { Router } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { notes } from "../db/schema.js";
import { authMiddleware } from "../lib/auth.js";

export const notesRouter = Router();
notesRouter.use(authMiddleware);

const createNoteSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().max(200_000).default(""),
});

const updateNoteSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().max(200_000).optional(),
});

/** GET /?q= — list notes, optional case-insensitive search over title+content. */
notesRouter.get("/", async (req, res) => {
  const userId = req.userId ?? "";
  const q = String(req.query.q ?? "").trim();

  const base = eq(notes.userId, userId);
  // Escape LIKE wildcards so the query is treated literally.
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = q
    ? await db
        .select()
        .from(notes)
        .where(and(base, or(ilike(notes.title, pattern), ilike(notes.content, pattern))))
        .orderBy(desc(notes.updatedAt))
    : await db.select().from(notes).where(base).orderBy(desc(notes.updatedAt));

  res.json({ notes: rows });
});

/** POST / — create a note. */
notesRouter.post("/", async (req, res) => {
  const parsed = createNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const inserted = await db
    .insert(notes)
    .values({ userId: req.userId ?? "", ...parsed.data })
    .returning();
  res.status(201).json({ note: inserted[0] });
});

/** PATCH /:id */
notesRouter.patch("/:id", async (req, res) => {
  const parsed = updateNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const updated = await db
    .update(notes)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(notes.id, req.params.id ?? ""), eq(notes.userId, req.userId ?? "")))
    .returning();
  const note = updated[0];
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json({ note });
});

/** DELETE /:id */
notesRouter.delete("/:id", async (req, res) => {
  const deleted = await db
    .delete(notes)
    .where(and(eq(notes.id, req.params.id ?? ""), eq(notes.userId, req.userId ?? "")))
    .returning({ id: notes.id });
  if (!deleted[0]) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json({ ok: true });
});
