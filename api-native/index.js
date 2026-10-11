/**
 * StudyGen AI — native Vercel serverless API (no Express, no bundling).
 *
 * Single CommonJS function. Vercel routes /api/* here (see vercel.json
 * rewrite or api/[...path] catch-all). Manual routing, raw SQL via the
 * Neon HTTP driver, JWT auth via jsonwebtoken + bcryptjs.
 *
 * Endpoints:
 *   GET  /api/health
 *   POST /api/auth/register   {email,password,name}
 *   POST /api/auth/login      {email,password}
 *   GET  /api/auth/me        (auth)
 *   GET  /api/decks          (auth)
 *   POST /api/decks          (auth) {title,sourceType,sourceName?,summary?}
 *   GET  /api/decks/:id      (auth)
 *   DELETE /api/decks/:id    (auth)
 *   GET  /api/flashcards/due (auth) ?limit=
 *   POST /api/flashcards/review (auth) {cardId,grade}
 *   POST /api/flashcards     (auth) {deckId,front,back}
 *   GET  /api/study/today    (auth)
 */

"use strict";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

function setCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

function readBody(req) {
  // Vercel may pre-parse JSON bodies on req.body.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      const t = req.body.trim();
      return Promise.resolve(t ? JSON.parse(t) : {});
    }
    return Promise.resolve(req.body);
  }
  // Event-based reading with timeout — more reliable than for-await on Vercel.
  return new Promise((resolve, reject) => {
    const chunks = [];
    const timer = setTimeout(() => {
      // Timeout: assume empty body rather than hanging
      resolve({});
    }, 3000);
    const cleanup = () => clearTimeout(timer);
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      cleanup();
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new HttpError(400, "Invalid JSON body"));
      }
    });
    req.on("error", (e) => {
      cleanup();
      reject(new HttpError(400, "Body read error"));
    });
    // If req is already ended or not a stream, resolve empty
    if (req.readableEnded || req.complete) {
      cleanup();
      resolve({});
    }
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUuid(s) {
  return typeof s === "string" && UUID_RE.test(s);
}

// ---------------------------------------------------------------------------
// response shaping — the client expects camelCase bare payloads
// ---------------------------------------------------------------------------

function camelKey(k) {
  return k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function camel(row) {
  if (!row || typeof row !== "object") return row;
  if (Array.isArray(row)) return row.map(camel);
  const out = {};
  for (const k of Object.keys(row)) out[camelKey(k)] = row[k];
  return out;
}

// ---------------------------------------------------------------------------
// db (lazy — never imported/touched until a DB route runs)
// ---------------------------------------------------------------------------

let sql = null;

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new HttpError(503, "Database not configured — set DATABASE_URL");
  }
  if (!sql) {
    // Required lazily so a missing/broken driver never breaks non-DB routes.
    const { neon } = require("@neondatabase/serverless");
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new HttpError(500, "JWT_SECRET is not set");
  return s;
}

function signToken(userId) {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ userId }, jwtSecret(), { expiresIn: "7d" });
}

function authUserId(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const [scheme, token] = String(header).split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    throw new HttpError(401, "Missing or malformed Authorization header");
  }
  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, jwtSecret());
    if (!decoded || typeof decoded !== "object" || !decoded.userId) {
      throw new Error("bad payload");
    }
    return String(decoded.userId);
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

// ---------------------------------------------------------------------------
// SM-2 (ported from server/src/lib/sm2.ts)
// ---------------------------------------------------------------------------

const MIN_EASINESS = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

function sm2(card, grade, now = new Date()) {
  let { easiness, interval, repetitions } = card;
  if (grade === 1) {
    repetitions = 0;
    interval = 1;
    easiness = Math.max(MIN_EASINESS, easiness - 0.2);
  } else if (grade === 2) {
    repetitions = 0;
    interval = 1;
    easiness = Math.max(MIN_EASINESS, easiness - 0.15);
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.max(1, Math.round(interval * easiness));
    if (grade === 4) easiness += 0.1;
  }
  return {
    easiness: Math.round(easiness * 100) / 100,
    interval,
    repetitions,
    dueAt: new Date(now.getTime() + interval * DAY_MS),
  };
}

// ---------------------------------------------------------------------------
// route handlers
// ---------------------------------------------------------------------------

async function handleRegister(body) {
  const { email, password, name } = body || {};
  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 255)
    throw new HttpError(400, "Invalid email");
  if (typeof password !== "string" || password.length < 8 || password.length > 128)
    throw new HttpError(400, "Password must be 8–128 characters");
  if (typeof name !== "string" || !name.trim() || name.length > 120)
    throw new HttpError(400, "Invalid name");

  const db = getSql();
  const existing = await db`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length) throw new HttpError(409, "Email already registered");

  const bcrypt = require("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 10);
  const rows = await db`
    INSERT INTO users (id, email, password_hash, name, role, created_at)
    VALUES (gen_random_uuid(), ${email}, ${passwordHash}, ${name}, 'user', now())
    RETURNING id, email, name, role`;
  const user = rows[0];
  if (!user) throw new HttpError(500, "Failed to create user");
  return { status: 201, body: { token: signToken(user.id), user: publicUser(user) } };
}

async function handleLogin(body) {
  const { email, password } = body || {};
  if (typeof email !== "string" || !EMAIL_RE.test(email))
    throw new HttpError(400, "Invalid email");
  if (typeof password !== "string" || !password)
    throw new HttpError(400, "Invalid password");

  const db = getSql();
  const rows = await db`SELECT id, email, password_hash, name, role FROM users WHERE email = ${email} LIMIT 1`;
  const user = rows[0];
  const bcrypt = require("bcryptjs");
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, "Invalid email or password");
  }
  return { status: 200, body: { token: signToken(user.id), user: publicUser(user) } };
}

async function handleMe(userId) {
  const db = getSql();
  const rows = await db`SELECT id, email, name, role FROM users WHERE id = ${userId} LIMIT 1`;
  const user = rows[0];
  if (!user) throw new HttpError(404, "User not found");
  return { status: 200, body: { user: publicUser(user) } };
}

async function handleListDecks(userId) {
  const db = getSql();
  const rows = await db`
    SELECT d.id, d.title, d.source_type, d.source_name, d.summary, d.status, d.created_at,
           COUNT(DISTINCT f.id)::int AS card_count,
           COUNT(DISTINCT q.id)::int AS quiz_count
    FROM decks d
    LEFT JOIN flashcards f ON f.deck_id = d.id
    LEFT JOIN quizzes q ON q.deck_id = d.id
    WHERE d.user_id = ${userId}
    GROUP BY d.id
    ORDER BY d.created_at ASC`;
  return { status: 200, body: camel(rows) };
}

const SOURCE_TYPES = ["pdf", "youtube", "text", "topic"];

async function handleCreateDeck(userId, body) {
  const { title, sourceType, sourceName, summary } = body || {};
  if (typeof title !== "string" || !title.trim() || title.length > 300)
    throw new HttpError(400, "Invalid title");
  if (!SOURCE_TYPES.includes(sourceType))
    throw new HttpError(400, "Invalid sourceType");
  if (sourceName !== undefined && (typeof sourceName !== "string" || sourceName.length > 300))
    throw new HttpError(400, "Invalid sourceName");
  if (summary !== undefined && (typeof summary !== "string" || summary.length > 60000))
    throw new HttpError(400, "Invalid summary");

  const db = getSql();
  const rows = await db`
    INSERT INTO decks (id, user_id, title, source_type, source_name, summary, status, created_at)
    VALUES (gen_random_uuid(), ${userId}, ${title}, ${sourceType}, ${sourceName ?? null}, ${summary ?? null}, 'ready', now())
    RETURNING *`;
  return { status: 201, body: camel(rows[0]) };
}

async function handleGetDeck(userId, deckId) {
  if (!isUuid(deckId)) throw new HttpError(404, "Deck not found");
  const db = getSql();
  const deckRows = await db`SELECT * FROM decks WHERE id = ${deckId} AND user_id = ${userId} LIMIT 1`;
  const deck = deckRows[0];
  if (!deck) throw new HttpError(404, "Deck not found");
  const [cards, deckQuizzes] = await Promise.all([
    db`SELECT * FROM flashcards WHERE deck_id = ${deckId} ORDER BY order_index ASC`,
    db`SELECT * FROM quizzes WHERE deck_id = ${deckId} ORDER BY created_at ASC`,
  ]);
  const [cardCount, quizCount] = [
    cards.length,
    deckQuizzes.length,
  ];
  return {
    status: 200,
    body: {
      deck: { ...camel(deck), cardCount, quizCount },
      flashcards: camel(cards),
      quizzes: camel(deckQuizzes),
    },
  };
}

async function handleDeleteDeck(userId, deckId) {
  if (!isUuid(deckId)) throw new HttpError(404, "Deck not found");
  const db = getSql();
  const rows = await db`DELETE FROM decks WHERE id = ${deckId} AND user_id = ${userId} RETURNING id`;
  if (!rows.length) throw new HttpError(404, "Deck not found");
  return { status: 200, body: { ok: true } };
}

async function handleDueCards(userId, query) {
  const raw = parseInt(String(query.limit ?? "50"), 10);
  const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 50, 1), 500);
  const db = getSql();
  const rows = await db`
    SELECT * FROM flashcards
    WHERE user_id = ${userId} AND due_at <= now()
    ORDER BY due_at ASC
    LIMIT ${limit}`;
  return { status: 200, body: camel(rows) };
}

async function handleReviewCard(userId, body) {
  const { cardId, grade } = body || {};
  if (!isUuid(cardId)) throw new HttpError(400, "Invalid cardId");
  if (![1, 2, 3, 4].includes(grade)) throw new HttpError(400, "Invalid grade");

  const db = getSql();
  const rows = await db`SELECT * FROM flashcards WHERE id = ${cardId} AND user_id = ${userId} LIMIT 1`;
  const card = rows[0];
  if (!card) throw new HttpError(404, "Card not found");

  const next = sm2(
    {
      easiness: Number(card.easiness),
      interval: Number(card.interval),
      repetitions: Number(card.repetitions),
    },
    grade,
  );

  const updated = await db`
    UPDATE flashcards
    SET easiness = ${next.easiness}, interval = ${next.interval},
        repetitions = ${next.repetitions}, due_at = ${next.dueAt.toISOString()}
    WHERE id = ${cardId}
    RETURNING *`;

  await db`
    INSERT INTO review_logs (id, user_id, card_id, grade, reviewed_at)
    VALUES (gen_random_uuid(), ${userId}, ${cardId}, ${grade}, now())`;

  return { status: 200, body: camel(updated[0]) };
}

async function handleCreateCard(userId, body) {
  const { deckId, front, back } = body || {};
  if (!isUuid(deckId)) throw new HttpError(400, "Invalid deckId");
  if (typeof front !== "string" || !front.trim() || front.length > 5000)
    throw new HttpError(400, "Invalid front");
  if (typeof back !== "string" || !back.trim() || back.length > 5000)
    throw new HttpError(400, "Invalid back");

  const db = getSql();
  const own = await db`SELECT id FROM decks WHERE id = ${deckId} AND user_id = ${userId} LIMIT 1`;
  if (!own.length) throw new HttpError(404, "Deck not found");

  const rows = await db`
    INSERT INTO flashcards (id, deck_id, user_id, front, back, order_index, easiness, interval, repetitions, due_at, created_at)
    VALUES (gen_random_uuid(), ${deckId}, ${userId}, ${front}, ${back}, 0, 2.5, 0, 0, now(), now())
    RETURNING *`;
  return { status: 201, body: camel(rows[0]) };
}

async function handleToday(userId) {
  const db = getSql();
  const [dueRows, deckRows, focusRows] = await Promise.all([
    db`SELECT COUNT(*)::int AS n FROM flashcards WHERE user_id = ${userId} AND due_at <= now()`,
    db`SELECT COUNT(*)::int AS n FROM decks WHERE user_id = ${userId}`,
    db`SELECT COALESCE(SUM(minutes),0)::int AS minutes, COALESCE(SUM(xp),0)::int AS xp
        FROM focus_sessions
        WHERE user_id = ${userId} AND completed_at >= date_trunc('day', now())`,
  ]);
  return {
    status: 200,
    body: {
      dueCount: dueRows[0]?.n ?? 0,
      decksCount: deckRows[0]?.n ?? 0,
      focusMinutesToday: focusRows[0]?.minutes ?? 0,
      xpToday: focusRows[0]?.xp ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// quizzes
// ---------------------------------------------------------------------------

async function ownQuiz(userId, quizId) {
  if (!isUuid(quizId)) return null;
  const db = getSql();
  const rows = await db`SELECT * FROM quizzes WHERE id = ${quizId} AND user_id = ${userId} LIMIT 1`;
  return rows[0] || null;
}

async function handleQuizCreate(userId, body) {
  const { deckId, title, timeLimitS, questions } = body || {};
  if (!isUuid(deckId)) throw new HttpError(400, "Invalid deckId");
  if (
    title !== undefined &&
    (typeof title !== "string" || !title.trim() || title.length > 300)
  )
    throw new HttpError(400, "Invalid title");
  if (
    timeLimitS !== undefined &&
    (!Number.isInteger(timeLimitS) || timeLimitS < 10 || timeLimitS > 7200)
  )
    throw new HttpError(400, "Invalid timeLimitS");
  if (questions !== undefined) {
    if (!Array.isArray(questions) || questions.length < 1 || questions.length > 50)
      throw new HttpError(400, "Invalid questions");
    for (const q of questions) {
      if (
        !q ||
        typeof q.question !== "string" ||
        !q.question.trim() ||
        q.question.length > 5000
      )
        throw new HttpError(400, "Invalid question text");
      if (
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        q.options.some(
          (o) => typeof o !== "string" || !o.trim() || o.length > 2000,
        )
      )
        throw new HttpError(400, "Invalid question options");
      if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3)
        throw new HttpError(400, "Invalid correct index");
      if (
        q.explanation !== undefined &&
        (typeof q.explanation !== "string" || q.explanation.length > 5000)
      )
        throw new HttpError(400, "Invalid explanation");
    }
  }

  const db = getSql();
  const deckRows = await db`SELECT id, title FROM decks WHERE id = ${deckId} AND user_id = ${userId} LIMIT 1`;
  const deck = deckRows[0];
  if (!deck) throw new HttpError(404, "Deck not found");

  const inserted = await db`
    INSERT INTO quizzes (id, user_id, deck_id, title, time_limit_s, created_at)
    VALUES (gen_random_uuid(), ${userId}, ${deckId}, ${title && title.trim() ? title : `${deck.title} — Quiz`}, ${timeLimitS ?? null}, now())
    RETURNING *`;
  const quiz = inserted[0];
  if (!quiz) throw new HttpError(500, "Failed to create quiz");

  if (questions && questions.length > 0) {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await db`
        INSERT INTO quiz_questions (id, quiz_id, question, options, correct_index, explanation, order_index)
        VALUES (gen_random_uuid(), ${quiz.id}, ${q.question}, ${JSON.stringify(q.options)}::jsonb, ${q.correct}, ${q.explanation ?? ""}, ${i})`;
    }
  }

  const qs = await db`SELECT * FROM quiz_questions WHERE quiz_id = ${quiz.id} ORDER BY order_index ASC`;
  return { status: 201, body: { ...camel(quiz), questions: camel(qs) } };
}

async function handleQuizGet(userId, quizId) {
  const quiz = await ownQuiz(userId, quizId);
  if (!quiz) throw new HttpError(404, "Quiz not found");
  const db = getSql();
  const qs = await db`SELECT * FROM quiz_questions WHERE quiz_id = ${quiz.id} ORDER BY order_index ASC`;
  return { status: 200, body: { ...camel(quiz), questions: camel(qs) } };
}

/**
 * Grade answers, persist the attempt, and auto-create flashcards for
 * missed questions (deduped by exact front match within the deck).
 */
async function handleQuizAttempt(userId, quizId, body) {
  const { answers } = body || {};
  if (!Array.isArray(answers) || answers.length < 1)
    throw new HttpError(400, "Invalid answers");
  for (const a of answers) {
    if (
      !a ||
      !isUuid(a.questionId) ||
      !Number.isInteger(a.selected) ||
      a.selected < 0 ||
      a.selected > 3
    )
      throw new HttpError(400, "Invalid answer");
  }
  const quiz = await ownQuiz(userId, quizId);
  if (!quiz) throw new HttpError(404, "Quiz not found");

  const db = getSql();
  const qs = await db`SELECT * FROM quiz_questions WHERE quiz_id = ${quiz.id} ORDER BY order_index ASC`;
  const byId = new Map(qs.map((q) => [q.id, q]));

  let score = 0;
  const missed = [];
  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q) continue;
    if (a.selected === Number(q.correct_index)) score += 1;
    else missed.push(q);
  }
  const total = answers.length;

  const inserted = await db`
    INSERT INTO quiz_attempts (id, quiz_id, user_id, score, total, answers, completed_at)
    VALUES (gen_random_uuid(), ${quiz.id}, ${userId}, ${score}, ${total}, ${JSON.stringify(answers)}::jsonb, now())
    RETURNING id`;
  const attemptId = inserted[0] ? inserted[0].id : null;

  let cardsCreated = 0;
  if (missed.length > 0) {
    const existing =
      await db`SELECT front FROM flashcards WHERE deck_id = ${quiz.deck_id} AND user_id = ${userId}`;
    const fronts = new Set(existing.map((c) => c.front));
    for (const q of missed) {
      if (fronts.has(q.question)) continue;
      const opts = Array.isArray(q.options) ? q.options : [];
      const correctOption = opts[Number(q.correct_index)] || "";
      const back = q.explanation
        ? `${correctOption}\n\n${q.explanation}`
        : correctOption;
      await db`
        INSERT INTO flashcards (id, deck_id, user_id, front, back, order_index, easiness, interval, repetitions, due_at, created_at)
        VALUES (gen_random_uuid(), ${quiz.deck_id}, ${userId}, ${q.question}, ${back}, 0, 2.5, 0, 0, now(), now())`;
      fronts.add(q.question);
      cardsCreated += 1;
    }
  }

  return { status: 201, body: { score, total, attemptId, cardsCreated } };
}

async function handleQuizAttempts(userId, quizId) {
  const quiz = await ownQuiz(userId, quizId);
  if (!quiz) throw new HttpError(404, "Quiz not found");
  const db = getSql();
  const attempts = await db`SELECT * FROM quiz_attempts WHERE quiz_id = ${quiz.id} ORDER BY completed_at ASC`;
  return { status: 200, body: camel(attempts) };
}

// ---------------------------------------------------------------------------
// notes
// ---------------------------------------------------------------------------

async function handleNotesList(userId, query) {
  const q = String(query.q ?? "").trim();
  const db = getSql();
  let rows;
  if (q) {
    // Escape LIKE wildcards so the query is treated literally.
    const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    rows = await db`
      SELECT * FROM notes
      WHERE user_id = ${userId}
        AND (title ILIKE ${pattern} ESCAPE '\' OR content ILIKE ${pattern} ESCAPE '\')
      ORDER BY updated_at DESC`;
  } else {
    rows = await db`SELECT * FROM notes WHERE user_id = ${userId} ORDER BY updated_at DESC`;
  }
  return { status: 200, body: camel(rows) };
}

async function handleNotesCreate(userId, body) {
  const { title, content } = body || {};
  if (typeof title !== "string" || !title.trim() || title.length > 300)
    throw new HttpError(400, "Invalid title");
  if (content !== undefined && (typeof content !== "string" || content.length > 200000))
    throw new HttpError(400, "Invalid content");

  const db = getSql();
  const rows = await db`
    INSERT INTO notes (id, user_id, title, content, created_at, updated_at)
    VALUES (gen_random_uuid(), ${userId}, ${title}, ${content ?? ""}, now(), now())
    RETURNING *`;
  return { status: 201, body: camel(rows[0]) };
}

async function handleNotesUpdate(userId, noteId, body) {
  if (!isUuid(noteId)) throw new HttpError(404, "Note not found");
  const { title, content } = body || {};
  if (title !== undefined && (typeof title !== "string" || !title.trim() || title.length > 300))
    throw new HttpError(400, "Invalid title");
  if (content !== undefined && (typeof content !== "string" || content.length > 200000))
    throw new HttpError(400, "Invalid content");
  if (title === undefined && content === undefined)
    throw new HttpError(400, "Nothing to update");

  const db = getSql();
  const rows = await db`
    UPDATE notes
    SET title = COALESCE(${title ?? null}, title),
        content = COALESCE(${content ?? null}, content),
        updated_at = now()
    WHERE id = ${noteId} AND user_id = ${userId}
    RETURNING *`;
  if (!rows.length) throw new HttpError(404, "Note not found");
  return { status: 200, body: camel(rows[0]) };
}

async function handleNotesDelete(userId, noteId) {
  if (!isUuid(noteId)) throw new HttpError(404, "Note not found");
  const db = getSql();
  const rows = await db`DELETE FROM notes WHERE id = ${noteId} AND user_id = ${userId} RETURNING id`;
  if (!rows.length) throw new HttpError(404, "Note not found");
  return { status: 200, body: { ok: true } };
}

// ---------------------------------------------------------------------------
// learning paths
// ---------------------------------------------------------------------------

async function ownPath(userId, pathId) {
  if (!isUuid(pathId)) return null;
  const db = getSql();
  const rows =
    await db`SELECT * FROM learning_paths WHERE id = ${pathId} AND user_id = ${userId} LIMIT 1`;
  return rows[0] || null;
}

async function handlePathsList(userId) {
  const db = getSql();
  const rows = await db`SELECT * FROM learning_paths WHERE user_id = ${userId} ORDER BY created_at ASC`;
  return { status: 200, body: camel(rows) };
}

async function handlePathsCreate(userId, body) {
  const { title, description } = body || {};
  if (typeof title !== "string" || !title.trim() || title.length > 300)
    throw new HttpError(400, "Invalid title");
  if (description !== undefined && (typeof description !== "string" || description.length > 5000))
    throw new HttpError(400, "Invalid description");

  const db = getSql();
  const rows = await db`
    INSERT INTO learning_paths (id, user_id, title, description, created_at)
    VALUES (gen_random_uuid(), ${userId}, ${title}, ${description ?? null}, now())
    RETURNING *`;
  return { status: 201, body: camel(rows[0]) };
}

async function handlePathGet(userId, pathId) {
  const path = await ownPath(userId, pathId);
  if (!path) throw new HttpError(404, "Path not found");
  const db = getSql();
  const topics = await db`SELECT * FROM path_topics WHERE path_id = ${path.id} ORDER BY order_index ASC`;
  return { status: 200, body: { ...camel(path), topics: camel(topics) } };
}

async function handleTopicCreate(userId, pathId, body) {
  const path = await ownPath(userId, pathId);
  if (!path) throw new HttpError(404, "Path not found");
  const { title, description, parentId } = body || {};
  if (typeof title !== "string" || !title.trim() || title.length > 300)
    throw new HttpError(400, "Invalid title");
  if (description !== undefined && (typeof description !== "string" || description.length > 5000))
    throw new HttpError(400, "Invalid description");
  if (parentId !== undefined && parentId !== null && !isUuid(parentId))
    throw new HttpError(400, "Invalid parentId");

  const db = getSql();
  const existing =
    await db`SELECT order_index FROM path_topics WHERE path_id = ${path.id} ORDER BY order_index ASC LIMIT 1000`;
  const nextOrder =
    existing.length > 0 ? Number(existing[existing.length - 1].order_index ?? -1) + 1 : 0;

  const rows = await db`
    INSERT INTO path_topics (id, path_id, title, description, status, order_index, parent_id)
    VALUES (gen_random_uuid(), ${path.id}, ${title}, ${description ?? null}, 'todo', ${nextOrder}, ${parentId ?? null})
    RETURNING *`;
  return { status: 201, body: camel(rows[0]) };
}

const TOPIC_STATUSES = ["todo", "doing", "done"];

async function handleTopicUpdate(userId, topicId, body) {
  if (!isUuid(topicId)) throw new HttpError(404, "Topic not found");
  const { title, description, status } = body || {};
  if (title !== undefined && (typeof title !== "string" || !title.trim() || title.length > 300))
    throw new HttpError(400, "Invalid title");
  if (
    description !== undefined &&
    description !== null &&
    (typeof description !== "string" || description.length > 5000)
  )
    throw new HttpError(400, "Invalid description");
  if (status !== undefined && !TOPIC_STATUSES.includes(status))
    throw new HttpError(400, "Invalid status");
  if (title === undefined && description === undefined && status === undefined)
    throw new HttpError(400, "Nothing to update");

  const db = getSql();
  // Scope through path ownership.
  const owned = await db`
    SELECT t.id FROM path_topics t
    INNER JOIN learning_paths p ON t.path_id = p.id
    WHERE t.id = ${topicId} AND p.user_id = ${userId}
    LIMIT 1`;
  if (!owned.length) throw new HttpError(404, "Topic not found");

  // Build the SET clause dynamically so `undefined` means "leave alone"
  // while `null` clears the description (matches the Express behavior).
  const sets = [];
  const vals = [];
  if (title !== undefined) {
    vals.push(title);
    sets.push(`title = $${vals.length}`);
  }
  if (description !== undefined) {
    vals.push(description);
    sets.push(`description = $${vals.length}`);
  }
  if (status !== undefined) {
    vals.push(status);
    sets.push(`status = $${vals.length}`);
  }
  vals.push(topicId);
  const rows = await db.unsafe(
    `UPDATE path_topics SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING *`,
    vals,
  );
  return { status: 200, body: camel(rows[0]) };
}

async function handlePathDelete(userId, pathId) {
  if (!isUuid(pathId)) throw new HttpError(404, "Path not found");
  const db = getSql();
  const rows =
    await db`DELETE FROM learning_paths WHERE id = ${pathId} AND user_id = ${userId} RETURNING id`;
  if (!rows.length) throw new HttpError(404, "Path not found");
  return { status: 200, body: { ok: true } };
}

// ---------------------------------------------------------------------------
// bookmarks
// ---------------------------------------------------------------------------

const BOOKMARK_KINDS = ["deck", "note", "path", "url", "quiz", "card"];

async function handleBookmarksList(userId) {
  const db = getSql();
  const rows = await db`SELECT * FROM bookmarks WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return { status: 200, body: camel(rows) };
}

async function handleBookmarksCreate(userId, body) {
  const { kind, refId, label } = body || {};
  if (!BOOKMARK_KINDS.includes(kind)) throw new HttpError(400, "Invalid kind");
  if (typeof refId !== "string" || !refId.trim() || refId.length > 500)
    throw new HttpError(400, "Invalid refId");
  if (typeof label !== "string" || !label.trim() || label.length > 300)
    throw new HttpError(400, "Invalid label");

  const db = getSql();
  const rows = await db`
    INSERT INTO bookmarks (id, user_id, kind, ref_id, label, created_at)
    VALUES (gen_random_uuid(), ${userId}, ${kind}, ${refId}, ${label}, now())
    RETURNING *`;
  return { status: 201, body: camel(rows[0]) };
}

async function handleBookmarkDelete(userId, bookmarkId) {
  if (!isUuid(bookmarkId)) throw new HttpError(404, "Bookmark not found");
  const db = getSql();
  const rows =
    await db`DELETE FROM bookmarks WHERE id = ${bookmarkId} AND user_id = ${userId} RETURNING id`;
  if (!rows.length) throw new HttpError(404, "Bookmark not found");
  return { status: 200, body: { ok: true } };
}

// ---------------------------------------------------------------------------
// study extras: focus, heatmap, recommendations
// ---------------------------------------------------------------------------

const XP_PER_MINUTE = 2;

async function handleFocus(userId, body) {
  const { minutes } = body || {};
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480)
    throw new HttpError(400, "Invalid minutes");

  const db = getSql();
  const xp = minutes * XP_PER_MINUTE;
  await db`
    INSERT INTO focus_sessions (id, user_id, minutes, xp, completed_at)
    VALUES (gen_random_uuid(), ${userId}, ${minutes}, ${xp}, now())`;
  return { status: 201, body: { xp } };
}

async function handleHeatmap(userId) {
  const db = getSql();
  const days = 112;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const sinceIso = since.toISOString();

  const [reviews, sessions] = await Promise.all([
    db`
      SELECT to_char(reviewed_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
      FROM review_logs
      WHERE user_id = ${userId} AND reviewed_at >= ${sinceIso}
      GROUP BY to_char(reviewed_at, 'YYYY-MM-DD')`,
    db`
      SELECT to_char(completed_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
      FROM focus_sessions
      WHERE user_id = ${userId} AND completed_at >= ${sinceIso}
      GROUP BY to_char(completed_at, 'YYYY-MM-DD')`,
  ]);

  const totals = new Map();
  for (const r of [...reviews, ...sessions]) {
    totals.set(r.day, (totals.get(r.day) || 0) + Number(r.n));
  }
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: totals.get(key) || 0 });
  }
  return { status: 200, body: out };
}

async function handleRecommendations(userId) {
  const db = getSql();
  const recs = [];

  const dueRows = await db`
    SELECT COUNT(*)::int AS n FROM flashcards
    WHERE user_id = ${userId} AND due_at <= now()`;
  const dueCount = Number(dueRows[0]?.n ?? 0);
  if (dueCount > 0) {
    recs.push({
      type: "review",
      title: `Review ${dueCount} due card${dueCount === 1 ? "" : "s"}`,
      reason: "Spaced repetition works best when you clear due cards daily.",
      link: "/review",
    });
  }

  // Weak quizzes: average score < 70% across recent attempts.
  const attempts = await db`
    SELECT quiz_id, score, total FROM quiz_attempts
    WHERE user_id = ${userId}`;
  if (attempts.length >= 3) {
    const byQuiz = new Map();
    for (const a of attempts.slice(-20)) {
      const cur = byQuiz.get(a.quiz_id) || { s: 0, t: 0 };
      cur.s += Number(a.score);
      cur.t += Number(a.total);
      byQuiz.set(a.quiz_id, cur);
    }
    let worst = null;
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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const focusRows = await db`
    SELECT COUNT(*)::int AS n FROM focus_sessions
    WHERE user_id = ${userId} AND completed_at >= ${todayStart.toISOString()}`;
  if (Number(focusRows[0]?.n ?? 0) === 0) {
    recs.push({
      type: "focus",
      title: "Start a 25-minute focus session",
      reason: "No focus time logged today yet.",
      link: "/",
    });
  }

  if (recs.length === 0) {
    const deckRows = await db`SELECT COUNT(*)::int AS n FROM decks WHERE user_id = ${userId}`;
    if (Number(deckRows[0]?.n ?? 0) === 0) {
      recs.push({
        type: "start",
        title: "Create your first deck",
        reason: "Upload a PDF, paste a YouTube link, or type a topic to begin.",
        link: "/decks",
      });
    }
  }

  return { status: 200, body: { recommendations: recs } };
}

// ---------------------------------------------------------------------------
// AI (OpenAI-compatible). 503 when AI_API_KEY is missing.
// ---------------------------------------------------------------------------

function aiConfig() {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      503,
      "AI not configured — set AI_API_KEY to enable AI features.",
    );
  }
  return {
    apiKey,
    baseUrl: (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.AI_MODEL || "gpt-4o-mini",
  };
}

async function chatCompletion(messages, opts = {}) {
  const { apiKey, baseUrl, model } = aiConfig();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(res.status, `AI provider error (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content =
    data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null;
  if (!content) throw new HttpError(502, "AI provider returned an empty response.");
  return content;
}

const STUDY_PACK_SYSTEM = `You are StudyGen, an AI study companion. Given source content, produce a study pack as a single JSON object with exactly these keys:
- "summary": markdown string, 5-8 bullet points plus one "Key insight" line.
- "flashcards": array of 8-12 {"front","back"} — front is a question/prompt, back is a concise answer.
- "quiz": array of 5-8 {"question","options","correct","explanation"} — options is exactly 4 strings, correct is the 0-based index, explanation is one sentence.
Return ONLY the JSON object, no markdown fences.`;

const EXPLAIN_SYSTEM = {
  eli5: "Explain like the reader is 5 years old. Use tiny words, fun analogies, and short sentences. Markdown allowed.",
  simple:
    "Explain clearly for a beginner student. Avoid jargon, or define it when used. Use examples. Markdown allowed.",
  detailed:
    "Explain thoroughly for an advanced student. Cover nuances, edge cases, and connections to related ideas. Markdown allowed.",
};

async function handleStudyPack(userId, body) {
  const { title, sourceType, sourceName, content } = body || {};
  if (typeof title !== "string" || !title.trim() || title.length > 300)
    throw new HttpError(400, "Invalid title");
  if (!SOURCE_TYPES.includes(sourceType)) throw new HttpError(400, "Invalid sourceType");
  if (sourceName !== undefined && (typeof sourceName !== "string" || sourceName.length > 300))
    throw new HttpError(400, "Invalid sourceName");
  if (typeof content !== "string" || content.length < 20 || content.length > 120000)
    throw new HttpError(400, "Invalid content");
  aiConfig(); // 503 early when AI is not configured

  const db = getSql();
  const deckRows = await db`
    INSERT INTO decks (id, user_id, title, source_type, source_name, summary, status, created_at)
    VALUES (gen_random_uuid(), ${userId}, ${title}, ${sourceType}, ${sourceName ?? null}, NULL, 'generating', now())
    RETURNING *`;
  const deck = deckRows[0];
  if (!deck) throw new HttpError(500, "Failed to create deck");

  try {
    const raw = await chatCompletion(
      [
        { role: "system", content: STUDY_PACK_SYSTEM },
        {
          role: "user",
          content: `Title: ${title}\nSource type: ${sourceType}\nContent:\n"""\n${content.slice(0, 50000)}\n"""`,
        },
      ],
      { jsonMode: true, temperature: 0.7, maxTokens: 4000 },
    );
    let pack;
    try {
      pack = JSON.parse(raw);
    } catch {
      throw new HttpError(502, "AI provider returned invalid JSON.");
    }
    const summary = typeof pack.summary === "string" ? pack.summary : "";
    const flashcards = Array.isArray(pack.flashcards)
      ? pack.flashcards.filter(
          (c) => c && typeof c.front === "string" && typeof c.back === "string",
        )
      : [];
    const quiz = Array.isArray(pack.quiz)
      ? pack.quiz.filter(
          (q) =>
            q &&
            typeof q.question === "string" &&
            Array.isArray(q.options) &&
            q.options.length === 4 &&
            typeof q.correct === "number",
        )
      : [];

    if (flashcards.length > 0) {
      for (let i = 0; i < flashcards.length; i++) {
        const c = flashcards[i];
        await db`
          INSERT INTO flashcards (id, deck_id, user_id, front, back, order_index, easiness, interval, repetitions, due_at, created_at)
          VALUES (gen_random_uuid(), ${deck.id}, ${userId}, ${c.front}, ${c.back}, ${i}, 2.5, 0, 0, now(), now())`;
      }
    }

    let quizId = null;
    if (quiz.length > 0) {
      const quizRows = await db`
        INSERT INTO quizzes (id, user_id, deck_id, title, created_at)
        VALUES (gen_random_uuid(), ${userId}, ${deck.id}, ${`${title} — Quiz`}, now())
        RETURNING id`;
      quizId = quizRows[0] ? quizRows[0].id : null;
      if (quizId) {
        for (let i = 0; i < quiz.length; i++) {
          const q = quiz[i];
          const opts = q.options.map((o) => String(o).slice(0, 2000));
          await db`
            INSERT INTO quiz_questions (id, quiz_id, question, options, correct_index, explanation, order_index)
            VALUES (gen_random_uuid(), ${quizId}, ${String(q.question).slice(0, 5000)}, ${JSON.stringify(opts)}::jsonb, ${Math.min(Math.max(q.correct | 0, 0), 3)}, ${typeof q.explanation === "string" ? q.explanation.slice(0, 5000) : ""}, ${i})`;
        }
      }
    }

    await db`UPDATE decks SET summary = ${summary}, status = 'ready' WHERE id = ${deck.id}`;

    return {
      status: 201,
      body: {
        deckId: deck.id,
        quizId,
        summary,
        flashcards: flashcards.map((c) => ({ front: c.front, back: c.back })),
        quiz: quiz.map((q) => ({
          question: q.question,
          options: q.options,
          correct: q.correct,
          explanation: q.explanation ?? "",
        })),
      },
    };
  } catch (err) {
    await db`UPDATE decks SET status = 'failed' WHERE id = ${deck.id}`;
    throw err instanceof HttpError ? err : new HttpError(500, "AI request failed");
  }
}

const EXPLAIN_LEVELS = ["eli5", "simple", "detailed"];

async function handleExplain(userId, body) {
  const { topic, level = "simple" } = body || {};
  if (typeof topic !== "string" || topic.trim().length < 2 || topic.length > 2000)
    throw new HttpError(400, "Invalid topic");
  if (!EXPLAIN_LEVELS.includes(level)) throw new HttpError(400, "Invalid level");
  aiConfig();

  const explanation = await chatCompletion(
    [
      { role: "system", content: EXPLAIN_SYSTEM[level] },
      { role: "user", content: `Explain this topic:\n${topic.slice(0, 2000)}` },
    ],
    { temperature: 0.7, maxTokens: 2000 },
  );
  return { status: 200, body: { explanation, level } };
}

async function handleChat(userId, body) {
  const { deckId, messages } = body || {};
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 40)
    throw new HttpError(400, "Invalid messages");
  for (const m of messages) {
    if (
      !m ||
      !["system", "user", "assistant"].includes(m.role) ||
      typeof m.content !== "string" ||
      !m.content.trim() ||
      m.content.length > 8000
    )
      throw new HttpError(400, "Invalid message");
  }
  if (deckId !== undefined && deckId !== null && !isUuid(deckId))
    throw new HttpError(400, "Invalid deckId");
  aiConfig();

  const db = getSql();
  let summary = "";
  if (deckId) {
    const rows =
      await db`SELECT summary FROM decks WHERE id = ${deckId} AND user_id = ${userId} LIMIT 1`;
    summary = rows[0] && rows[0].summary ? rows[0].summary : "";
  }

  const history = messages.slice(-20);
  const reply = await chatCompletion(
    [
      {
        role: "system",
        content: `You are StudyGen, a friendly tutor. Answer the student's questions using the study material below as context. If the question goes beyond the material, say so briefly and still help.\n\nSTUDY MATERIAL:\n${summary.slice(0, 8000)}`,
      },
      ...history,
    ],
    { temperature: 0.7, maxTokens: 1200 },
  );
  return { status: 200, body: { reply } };
}

function extractYouTubeId(url) {
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
      if (m && m[2]) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

async function handleYoutubeTranscript(userId, query) {
  const id = extractYouTubeId(String(query.url ?? ""));
  if (!id) throw new HttpError(400, "Invalid YouTube URL");
  try {
    const { YoutubeTranscript } = require("youtube-transcript");
    const parts = await YoutubeTranscript.fetchTranscript(id);
    const text = parts
      .map((p) => p.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60000);
    if (!text) throw new HttpError(404, "No transcript available for this video");
    return { status: 200, body: { text, videoId: id } };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, "Failed to fetch transcript (captions may be disabled)");
  }
}

// ---------------------------------------------------------------------------
// admin
// ---------------------------------------------------------------------------

async function handleAdminStats(userId) {
  const db = getSql();
  const me = await db`SELECT role FROM users WHERE id = ${userId} LIMIT 1`;
  if (!me[0] || me[0].role !== "admin")
    throw new HttpError(403, "Admin access required");
  const [u, d, c] = await Promise.all([
    db`SELECT COUNT(*)::int AS n FROM users`,
    db`SELECT COUNT(*)::int AS n FROM decks`,
    db`SELECT COUNT(*)::int AS n FROM flashcards`,
  ]);
  return {
    status: 200,
    body: {
      users: Number(u[0]?.n ?? 0),
      decks: Number(d[0]?.n ?? 0),
      cards: Number(c[0]?.n ?? 0),
    },
  };
}

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------

async function route(req) {
  const method = (req.method || "GET").toUpperCase();
  const path = String(req.url || "/").split("?")[0];
  const query = {};
  try {
    const u = new URL(req.url, "http://localhost");
    for (const [k, v] of u.searchParams) query[k] = v;
  } catch {
    /* ignore */
  }

  // Public
  if (method === "GET" && path === "/api/health") {
    return { status: 200, body: { ok: true, service: "studygen-api" } };
  }
  if (method === "POST" && path === "/api/auth/register") {
    return handleRegister(await readBody(req));
  }
  if (method === "POST" && path === "/api/auth/login") {
    return handleLogin(await readBody(req));
  }

  // Everything below requires auth (also strips any /api prefix variants).
  const userId = authUserId(req);

  if (method === "GET" && path === "/api/auth/me") return handleMe(userId);
  if (method === "GET" && path === "/api/decks") return handleListDecks(userId);
  if (method === "POST" && path === "/api/decks") {
    return handleCreateDeck(userId, await readBody(req));
  }
  if (method === "GET" && path === "/api/flashcards/due") {
    return handleDueCards(userId, query);
  }
  if (method === "POST" && path === "/api/flashcards/review") {
    return handleReviewCard(userId, await readBody(req));
  }
  if (method === "POST" && path === "/api/flashcards") {
    return handleCreateCard(userId, await readBody(req));
  }
  if (method === "GET" && path === "/api/study/today") return handleToday(userId);
  if (method === "POST" && path === "/api/study/focus") {
    return handleFocus(userId, await readBody(req));
  }
  if (method === "GET" && path === "/api/study/heatmap") return handleHeatmap(userId);
  if (method === "GET" && path === "/api/study/recommendations")
    return handleRecommendations(userId);

  // AI
  if (method === "POST" && path === "/api/ai/study-pack") {
    return handleStudyPack(userId, await readBody(req));
  }
  if (method === "POST" && path === "/api/ai/explain") {
    return handleExplain(userId, await readBody(req));
  }
  if (method === "POST" && path === "/api/ai/chat") {
    return handleChat(userId, await readBody(req));
  }
  if (method === "GET" && path === "/api/ai/youtube-transcript") {
    return handleYoutubeTranscript(userId, query);
  }

  // admin
  if (method === "GET" && path === "/api/admin/stats") return handleAdminStats(userId);

  // quizzes — specific sub-routes before :id
  if (method === "POST" && path === "/api/quizzes") {
    return handleQuizCreate(userId, await readBody(req));
  }
  const quizAttemptMatch = path.match(/^\/api\/quizzes\/([^/]+)\/attempt$/);
  if (quizAttemptMatch && method === "POST") {
    return handleQuizAttempt(userId, quizAttemptMatch[1], await readBody(req));
  }
  const quizAttemptsMatch = path.match(/^\/api\/quizzes\/([^/]+)\/attempts$/);
  if (quizAttemptsMatch && method === "GET") {
    return handleQuizAttempts(userId, quizAttemptsMatch[1]);
  }
  const quizMatch = path.match(/^\/api\/quizzes\/([^/]+)$/);
  if (quizMatch && method === "GET") {
    return handleQuizGet(userId, quizMatch[1]);
  }

  // notes
  if (method === "GET" && path === "/api/notes") return handleNotesList(userId, query);
  if (method === "POST" && path === "/api/notes") {
    return handleNotesCreate(userId, await readBody(req));
  }
  const noteMatch = path.match(/^\/api\/notes\/([^/]+)$/);
  if (noteMatch) {
    if (method === "PATCH") return handleNotesUpdate(userId, noteMatch[1], await readBody(req));
    if (method === "DELETE") return handleNotesDelete(userId, noteMatch[1]);
  }

  // bookmarks
  if (method === "GET" && path === "/api/bookmarks") return handleBookmarksList(userId);
  if (method === "POST" && path === "/api/bookmarks") {
    return handleBookmarksCreate(userId, await readBody(req));
  }
  const bookmarkMatch = path.match(/^\/api\/bookmarks\/([^/]+)$/);
  if (bookmarkMatch && method === "DELETE") {
    return handleBookmarkDelete(userId, bookmarkMatch[1]);
  }

  // paths — /topics/:tid before /:id
  if (method === "GET" && path === "/api/paths") return handlePathsList(userId);
  if (method === "POST" && path === "/api/paths") {
    return handlePathsCreate(userId, await readBody(req));
  }
  const topicMatch = path.match(/^\/api\/paths\/topics\/([^/]+)$/);
  if (topicMatch && method === "PATCH") {
    return handleTopicUpdate(userId, topicMatch[1], await readBody(req));
  }
  const pathTopicsMatch = path.match(/^\/api\/paths\/([^/]+)\/topics$/);
  if (pathTopicsMatch && method === "POST") {
    return handleTopicCreate(userId, pathTopicsMatch[1], await readBody(req));
  }
  const pathMatch = path.match(/^\/api\/paths\/([^/]+)$/);
  if (pathMatch) {
    if (method === "GET") return handlePathGet(userId, pathMatch[1]);
    if (method === "DELETE") return handlePathDelete(userId, pathMatch[1]);
  }

  // /api/decks/:id
  const deckMatch = path.match(/^\/api\/decks\/([^/]+)$/);
  if (deckMatch) {
    const deckId = deckMatch[1];
    if (method === "GET") return handleGetDeck(userId, deckId);
    if (method === "DELETE") return handleDeleteDeck(userId, deckId);
  }

  throw new HttpError(404, "Not found");
}

// ---------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------

module.exports = async (req, res) => {
  setCors(req, res);
  if ((req.method || "GET").toUpperCase() === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  try {
    const { status, body } = await route(req);
    send(res, status, body);
  } catch (err) {
    if (err instanceof HttpError) {
      send(res, err.status, { error: err.message });
    } else {
      console.error("[api] unhandled error:", err && err.message ? err.message : err);
      send(res, 500, { error: "Internal server error" });
    }
  }
};
