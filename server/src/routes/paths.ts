import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { learningPaths, pathTopics } from "../db/schema.js";
import { authMiddleware } from "../lib/auth.js";

export const pathsRouter = Router();
pathsRouter.use(authMiddleware);

const createPathSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
});

const createTopicSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  parentId: z.string().uuid().optional(),
});

const updateTopicSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
});

/** GET / — list user's learning paths. */
pathsRouter.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(learningPaths)
    .where(eq(learningPaths.userId, req.userId ?? ""))
    .orderBy(learningPaths.createdAt);
  res.json({ paths: rows });
});

/** POST / — create a path. */
pathsRouter.post("/", async (req, res) => {
  const parsed = createPathSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const inserted = await db
    .insert(learningPaths)
    .values({ userId: req.userId ?? "", ...parsed.data })
    .returning();
  res.status(201).json({ path: inserted[0] });
});

/** GET /:id — path with its topics (flat list; client builds the tree). */
pathsRouter.get("/:id", async (req, res) => {
  const userId = req.userId ?? "";
  const pathRows = await db
    .select()
    .from(learningPaths)
    .where(and(eq(learningPaths.id, req.params.id ?? ""), eq(learningPaths.userId, userId)))
    .limit(1);
  const path = pathRows[0];
  if (!path) {
    res.status(404).json({ error: "Path not found" });
    return;
  }
  const topics = await db
    .select()
    .from(pathTopics)
    .where(eq(pathTopics.pathId, path.id))
    .orderBy(asc(pathTopics.orderIndex));
  res.json({ path, topics });
});

/** POST /:id/topics — add a topic (optionally nested via parentId). */
pathsRouter.post("/:id/topics", async (req, res) => {
  const parsed = createTopicSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const userId = req.userId ?? "";
  const pathRows = await db
    .select({ id: learningPaths.id })
    .from(learningPaths)
    .where(and(eq(learningPaths.id, req.params.id ?? ""), eq(learningPaths.userId, userId)))
    .limit(1);
  if (!pathRows[0]) {
    res.status(404).json({ error: "Path not found" });
    return;
  }

  const existing = await db
    .select({ orderIndex: pathTopics.orderIndex })
    .from(pathTopics)
    .where(eq(pathTopics.pathId, pathRows[0].id))
    .orderBy(asc(pathTopics.orderIndex))
    .limit(1000);
  const nextOrder = existing.length > 0 ? (existing[existing.length - 1]?.orderIndex ?? -1) + 1 : 0;

  const inserted = await db
    .insert(pathTopics)
    .values({
      pathId: pathRows[0].id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      parentId: parsed.data.parentId ?? null,
      orderIndex: nextOrder,
    })
    .returning();
  res.status(201).json({ topic: inserted[0] });
});

/** PATCH /topics/:tid — update topic (status/title/description). */
pathsRouter.patch("/topics/:tid", async (req, res) => {
  const parsed = updateTopicSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  // Scope the update through the path ownership join.
  const owned = await db
    .select({ id: pathTopics.id })
    .from(pathTopics)
    .innerJoin(learningPaths, eq(pathTopics.pathId, learningPaths.id))
    .where(
      and(
        eq(pathTopics.id, req.params.tid ?? ""),
        eq(learningPaths.userId, req.userId ?? ""),
      ),
    )
    .limit(1);
  if (!owned[0]) {
    res.status(404).json({ error: "Topic not found" });
    return;
  }
  const updated = await db
    .update(pathTopics)
    .set(parsed.data)
    .where(eq(pathTopics.id, req.params.tid ?? ""))
    .returning();
  res.json({ topic: updated[0] });
});

/** DELETE /:id — delete path (cascades to topics). */
pathsRouter.delete("/:id", async (req, res) => {
  const deleted = await db
    .delete(learningPaths)
    .where(
      and(eq(learningPaths.id, req.params.id ?? ""), eq(learningPaths.userId, req.userId ?? "")),
    )
    .returning({ id: learningPaths.id });
  if (!deleted[0]) {
    res.status(404).json({ error: "Path not found" });
    return;
  }
  res.json({ ok: true });
});
