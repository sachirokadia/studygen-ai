import "dotenv/config";
import cors from "cors";
import express from "express";
import { adminRouter } from "./routes/admin.js";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { bookmarksRouter } from "./routes/bookmarks.js";
import { decksRouter } from "./routes/decks.js";
import { flashcardsRouter } from "./routes/flashcards.js";
import { notesRouter } from "./routes/notes.js";
import { pathsRouter } from "./routes/paths.js";
import { quizzesRouter } from "./routes/quizzes.js";
import { studyRouter } from "./routes/study.js";

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "studygen-api" });
  });

  app.use("/auth", authRouter);
  app.use("/decks", decksRouter);
  app.use("/flashcards", flashcardsRouter);
  app.use("/quizzes", quizzesRouter);
  app.use("/notes", notesRouter);
  app.use("/paths", pathsRouter);
  app.use("/bookmarks", bookmarksRouter);
  app.use("/study", studyRouter);
  app.use("/ai", aiRouter);
  app.use("/admin", adminRouter);

  // 404 for unknown API routes.
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Central error handler — never leak stack traces in production.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("[api] unhandled error:", err);
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}

const app = createApp();
export default app;
