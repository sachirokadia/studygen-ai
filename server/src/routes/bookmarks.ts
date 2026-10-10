import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { bookmarks } from "../db/schema.js";
import { authMiddleware } from "../lib/auth.js";

export const bookmarksRouter = Router();
bookmarksRouter.use(authMiddleware);

const createBookmarkSchema = z.object({
  kind: z.enum(["deck", "note", "path", "url", "quiz", "card"]),
  refId: z.string().min(1).max(500),
  label: z.string().min(1).max(300),
});

/** GET / — list user's bookmarks. */
bookmarksRouter.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, req.userId ?? ""))
    .orderBy(desc(bookmarks.createdAt));
  res.json({ bookmarks: rows });
});

/** POST / — create a bookmark. */
bookmarksRouter.post("/", async (req, res) => {
  const parsed = createBookmarkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const inserted = await db
    .insert(bookmarks)
    .values({ userId: req.userId ?? "", ...parsed.data })
    .returning();
  res.status(201).json({ bookmark: inserted[0] });
});

/** DELETE /:id */
bookmarksRouter.delete("/:id", async (req, res) => {
  const deleted = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, req.params.id ?? ""), eq(bookmarks.userId, req.userId ?? "")))
    .returning({ id: bookmarks.id });
  if (!deleted[0]) {
    res.status(404).json({ error: "Bookmark not found" });
    return;
  }
  res.json({ ok: true });
});
