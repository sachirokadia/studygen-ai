/**
 * StudyGen AI — in-memory database fallback.
 *
 * Used when DATABASE_URL is not set. Implements the same query surface as the
 * Neon driver via a template-tag function, so handlers work unchanged.
 * Data lives in the Node process (lost on cold start) — demo mode only.
 *
 * Also exports `isDemoMode()` so the health endpoint can advertise it.
 */
"use strict";

const { randomUUID } = require("crypto");

function isDemoMode() {
  return !process.env.DATABASE_URL;
}

// ---------------------------------------------------------------------------
// tables
// ---------------------------------------------------------------------------

const tables = {
  users: [],
  decks: [],
  flashcards: [],
  quizzes: [],
  quiz_questions: [],
  quiz_attempts: [],
  review_logs: [],
  notes: [],
  learning_paths: [],
  path_topics: [],
  bookmarks: [],
  focus_sessions: [],
};

const nowIso = () => new Date().toISOString();
const byId = (arr, id) => arr.find((r) => r.id === id);
const dayOf = (iso) => String(iso).slice(0, 10);

// ---------------------------------------------------------------------------
// query execution — matches on normalized SQL prefixes
// ---------------------------------------------------------------------------

function norm(sql) {
  return sql.replace(/\s+/g, " ").trim();
}

function execute(rawSql, values) {
  const sql = norm(rawSql);
  const v = values || [];

  // -- users ---------------------------------------------------------------
  if (sql.startsWith("SELECT id FROM users WHERE email =")) {
    const u = tables.users.find((x) => x.email === v[0]);
    return u ? [{ id: u.id }] : [];
  }
  if (sql.startsWith("INSERT INTO users")) {
    const u = {
      id: randomUUID(),
      email: v[0],
      password_hash: v[1],
      name: v[2],
      role: "user",
      created_at: nowIso(),
    };
    tables.users.push(u);
    return [{ id: u.id, email: u.email, name: u.name, role: u.role }];
  }
  if (sql.startsWith("SELECT id, email, password_hash, name, role FROM users WHERE email =")) {
    const u = tables.users.find((x) => x.email === v[0]);
    return u ? [{ ...u }] : [];
  }
  if (sql.startsWith("SELECT id, email, name, role FROM users WHERE id =")) {
    const u = byId(tables.users, v[0]);
    return u ? [{ id: u.id, email: u.email, name: u.name, role: u.role }] : [];
  }
  if (sql.startsWith("SELECT role FROM users WHERE id =")) {
    const u = byId(tables.users, v[0]);
    return u ? [{ role: u.role }] : [];
  }
  if (sql === "SELECT COUNT(*)::int AS n FROM users") {
    return [{ n: tables.users.length }];
  }
  if (sql.startsWith("SELECT id, email, name, role, created_at FROM users")) {
    return [...tables.users]
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        created_at: u.created_at,
      }));
  }
  if (sql.startsWith("UPDATE users SET role =")) {
    const u = tables.users.find((x) => x.id === v[1]);
    if (u) u.role = v[0];
    return u ? [{ id: u.id, email: u.email, name: u.name, role: u.role }] : [];
  }

  // -- decks ----------------------------------------------------------------
  if (sql.startsWith("SELECT d.id, d.title, d.source_type")) {
    // list with card/quiz counts
    return tables.decks
      .filter((d) => d.user_id === v[0])
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      .map((d) => ({
        ...d,
        card_count: tables.flashcards.filter((f) => f.deck_id === d.id).length,
        quiz_count: tables.quizzes.filter((q) => q.deck_id === d.id).length,
      }));
  }
  if (sql.startsWith("INSERT INTO decks")) {
    const d = {
      id: randomUUID(),
      user_id: v[0],
      title: v[1],
      source_type: v[2],
      source_name: v[3] ?? null,
      summary: v[4] ?? null,
      status: sql.includes("'generating'") ? "generating" : "ready",
      created_at: nowIso(),
    };
    tables.decks.push(d);
    return [{ ...d }];
  }
  if (sql.startsWith("SELECT * FROM decks WHERE id =")) {
    const d = tables.decks.find((x) => x.id === v[0] && x.user_id === v[1]);
    return d ? [{ ...d }] : [];
  }
  if (sql.startsWith("SELECT id, title FROM decks WHERE id =")) {
    const d = tables.decks.find((x) => x.id === v[0] && x.user_id === v[1]);
    return d ? [{ id: d.id, title: d.title }] : [];
  }
  if (sql.startsWith("SELECT id FROM decks WHERE id =")) {
    const d = tables.decks.find((x) => x.id === v[0] && x.user_id === v[1]);
    return d ? [{ id: d.id }] : [];
  }
  if (sql.startsWith("SELECT summary FROM decks WHERE id =")) {
    const d = tables.decks.find((x) => x.id === v[0] && x.user_id === v[1]);
    return d ? [{ summary: d.summary }] : [];
  }
  if (sql.startsWith("SELECT COUNT(*)::int AS n FROM decks WHERE user_id =")) {
    return [{ n: tables.decks.filter((d) => d.user_id === v[0]).length }];
  }
  if (sql.startsWith("DELETE FROM decks WHERE id =")) {
    const i = tables.decks.findIndex((x) => x.id === v[0] && x.user_id === v[1]);
    if (i < 0) return [];
    const [d] = tables.decks.splice(i, 1);
    // cascade
    tables.flashcards = tables.flashcards.filter((f) => f.deck_id !== d.id);
    const qids = new Set(tables.quizzes.filter((q) => q.deck_id === d.id).map((q) => q.id));
    tables.quizzes = tables.quizzes.filter((q) => q.deck_id !== d.id);
    tables.quiz_questions = tables.quiz_questions.filter((q) => !qids.has(q.quiz_id));
    tables.quiz_attempts = tables.quiz_attempts.filter((q) => !qids.has(q.quiz_id));
    return [{ id: d.id }];
  }
  if (sql.startsWith("UPDATE decks SET summary =")) {
    const d = byId(tables.decks, v[1]);
    if (d) {
      d.summary = v[0];
      d.status = "ready";
    }
    return [];
  }
  if (sql.startsWith("UPDATE decks SET status = 'failed'")) {
    const d = byId(tables.decks, v[0]);
    if (d) d.status = "failed";
    return [];
  }

  // -- flashcards ------------------------------------------------------------
  if (sql.startsWith("SELECT * FROM flashcards WHERE deck_id =")) {
    return tables.flashcards
      .filter((f) => f.deck_id === v[0])
      .sort((a, b) => a.order_index - b.order_index)
      .map((f) => ({ ...f }));
  }
  if (sql.startsWith("SELECT COUNT(*)::int AS n FROM flashcards WHERE user_id =")) {
    const now = nowIso();
    return [
      {
        n: tables.flashcards.filter((f) => f.user_id === v[0] && f.due_at <= now).length,
      },
    ];
  }
  if (sql.startsWith("SELECT * FROM flashcards WHERE user_id =") && sql.includes("due_at <=")) {
    const now = nowIso();
    // Fix 9: deck-scoped query passes [userId, deckId, limit]; unfiltered passes [userId, limit].
    const hasDeck = sql.includes("deck_id =");
    const userId = v[0];
    const deckId = hasDeck ? v[1] : null;
    const limit = Number(hasDeck ? v[2] : v[1]) || 50;
    const rows = tables.flashcards
      .filter((f) => f.user_id === userId && (!deckId || f.deck_id === deckId) && f.due_at <= now)
      .sort((a, b) => (a.due_at < b.due_at ? -1 : 1));
    return rows.slice(0, limit).map((f) => ({ ...f }));
  }
  if (sql.startsWith("SELECT * FROM flashcards WHERE id =")) {
    const f = tables.flashcards.find((x) => x.id === v[0] && x.user_id === v[1]);
    return f ? [{ ...f }] : [];
  }
  if (sql.startsWith("SELECT front FROM flashcards WHERE deck_id =")) {
    return tables.flashcards
      .filter((f) => f.deck_id === v[0] && f.user_id === v[1])
      .map((f) => ({ front: f.front }));
  }
  if (sql === "SELECT COUNT(*)::int AS n FROM flashcards") {
    return [{ n: tables.flashcards.length }];
  }
  if (sql.startsWith("INSERT INTO flashcards")) {
    const hasOrder = v.length === 5;
    const f = {
      id: randomUUID(),
      deck_id: v[0],
      user_id: v[1],
      front: v[2],
      back: v[3],
      order_index: hasOrder ? v[4] : 0,
      easiness: 2.5,
      interval: 0,
      repetitions: 0,
      due_at: nowIso(),
      created_at: nowIso(),
    };
    tables.flashcards.push(f);
    return sql.includes("RETURNING") ? [{ ...f }] : [];
  }
  if (sql.startsWith("UPDATE flashcards SET easiness =")) {
    const f = byId(tables.flashcards, v[4]);
    if (f) {
      f.easiness = v[0];
      f.interval = v[1];
      f.repetitions = v[2];
      f.due_at = v[3];
    }
    return f ? [{ ...f }] : [];
  }
  if (sql.startsWith("INSERT INTO review_logs")) {
    tables.review_logs.push({
      id: randomUUID(),
      user_id: v[0],
      card_id: v[1],
      grade: v[2],
      reviewed_at: nowIso(),
    });
    return [];
  }

  // -- quizzes ----------------------------------------------------------------
  if (sql.startsWith("SELECT * FROM quizzes WHERE deck_id =")) {
    return tables.quizzes
      .filter((q) => q.deck_id === v[0])
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      .map((q) => ({ ...q }));
  }
  if (sql.startsWith("SELECT * FROM quizzes WHERE id =")) {
    const q = tables.quizzes.find((x) => x.id === v[0] && x.user_id === v[1]);
    return q ? [{ ...q }] : [];
  }
  if (sql.startsWith("INSERT INTO quizzes")) {
    const q = {
      id: randomUUID(),
      user_id: v[0],
      deck_id: v[1],
      title: v[2],
      time_limit_s: sql.includes("time_limit_s") ? v[3] ?? null : null,
      created_at: nowIso(),
    };
    tables.quizzes.push(q);
    return [{ ...q }];
  }
  if (sql.startsWith("INSERT INTO quiz_questions")) {
    let options = v[2];
    if (typeof options === "string") {
      try {
        options = JSON.parse(options);
      } catch {
        options = [];
      }
    }
    tables.quiz_questions.push({
      id: randomUUID(),
      quiz_id: v[0],
      question: v[1],
      options,
      correct_index: v[3],
      explanation: v[4] ?? "",
      order_index: v[5],
    });
    return [];
  }
  if (sql.startsWith("SELECT * FROM quiz_questions WHERE quiz_id =")) {
    return tables.quiz_questions
      .filter((q) => q.quiz_id === v[0])
      .sort((a, b) => a.order_index - b.order_index)
      .map((q) => ({ ...q }));
  }
  if (sql.startsWith("INSERT INTO quiz_attempts")) {
    let answers = v[4];
    if (typeof answers === "string") {
      try {
        answers = JSON.parse(answers);
      } catch {
        answers = [];
      }
    }
    const a = {
      id: randomUUID(),
      quiz_id: v[0],
      user_id: v[1],
      score: v[2],
      total: v[3],
      answers,
      completed_at: nowIso(),
    };
    tables.quiz_attempts.push(a);
    return [{ id: a.id }];
  }
  if (sql.startsWith("SELECT * FROM quiz_attempts WHERE quiz_id =")) {
    return tables.quiz_attempts
      .filter((a) => a.quiz_id === v[0])
      .sort((a, b) => (a.completed_at < b.completed_at ? -1 : 1))
      .map((a) => ({ ...a }));
  }
  if (sql.startsWith("SELECT quiz_id, score, total FROM quiz_attempts WHERE user_id =")) {
    return tables.quiz_attempts
      .filter((a) => a.user_id === v[0])
      .map((a) => ({ quiz_id: a.quiz_id, score: a.score, total: a.total }));
  }

  // -- notes -------------------------------------------------------------------
  if (sql.startsWith("SELECT * FROM notes WHERE user_id =") && sql.includes("ILIKE")) {
    const pattern = String(v[1]).replace(/%/g, "").toLowerCase();
    return tables.notes
      .filter(
        (n) =>
          n.user_id === v[0] &&
          (n.title.toLowerCase().includes(pattern) ||
            (n.content || "").toLowerCase().includes(pattern)),
      )
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
      .map((n) => ({ ...n }));
  }
  if (sql.startsWith("SELECT * FROM notes WHERE user_id =")) {
    return tables.notes
      .filter((n) => n.user_id === v[0])
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
      .map((n) => ({ ...n }));
  }
  if (sql.startsWith("INSERT INTO notes")) {
    const n = {
      id: randomUUID(),
      user_id: v[0],
      title: v[1],
      content: v[2] ?? "",
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    tables.notes.push(n);
    return [{ ...n }];
  }
  if (sql.startsWith("UPDATE notes SET")) {
    const n = tables.notes.find((x) => x.id === v[2] && x.user_id === v[3]);
    if (n) {
      if (v[0] !== null && v[0] !== undefined) n.title = v[0];
      if (v[1] !== null && v[1] !== undefined) n.content = v[1];
      n.updated_at = nowIso();
    }
    return n ? [{ ...n }] : [];
  }
  if (sql.startsWith("DELETE FROM notes WHERE id =")) {
    const i = tables.notes.findIndex((x) => x.id === v[0] && x.user_id === v[1]);
    if (i < 0) return [];
    return [{ id: tables.notes.splice(i, 1)[0].id }];
  }

  // -- learning paths ------------------------------------------------------------
  if (sql.startsWith("SELECT * FROM learning_paths WHERE id =")) {
    const p = tables.learning_paths.find((x) => x.id === v[0] && x.user_id === v[1]);
    return p ? [{ ...p }] : [];
  }
  if (sql.startsWith("SELECT * FROM learning_paths WHERE user_id =")) {
    return tables.learning_paths
      .filter((p) => p.user_id === v[0])
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      .map((p) => ({ ...p }));
  }
  if (sql.startsWith("INSERT INTO learning_paths")) {
    const p = {
      id: randomUUID(),
      user_id: v[0],
      title: v[1],
      description: v[2] ?? null,
      created_at: nowIso(),
    };
    tables.learning_paths.push(p);
    return [{ ...p }];
  }
  if (sql.startsWith("DELETE FROM learning_paths WHERE id =")) {
    const i = tables.learning_paths.findIndex((x) => x.id === v[0] && x.user_id === v[1]);
    if (i < 0) return [];
    const [p] = tables.learning_paths.splice(i, 1);
    tables.path_topics = tables.path_topics.filter((t) => t.path_id !== p.id);
    return [{ id: p.id }];
  }
  if (sql.startsWith("SELECT * FROM path_topics WHERE path_id =")) {
    return tables.path_topics
      .filter((t) => t.path_id === v[0])
      .sort((a, b) => a.order_index - b.order_index)
      .map((t) => ({ ...t }));
  }
  if (sql.startsWith("SELECT order_index FROM path_topics WHERE path_id =")) {
    return tables.path_topics
      .filter((t) => t.path_id === v[0])
      .sort((a, b) => a.order_index - b.order_index)
      .slice(0, 1000)
      .map((t) => ({ order_index: t.order_index }));
  }
  if (sql.startsWith("INSERT INTO path_topics")) {
    const t = {
      id: randomUUID(),
      path_id: v[0],
      title: v[1],
      description: v[2] ?? null,
      status: "todo",
      order_index: v[3],
      parent_id: v[4] ?? null,
    };
    tables.path_topics.push(t);
    return [{ ...t }];
  }
  if (sql.startsWith("SELECT t.id FROM path_topics t")) {
    const t = tables.path_topics.find((x) => x.id === v[0]);
    if (!t) return [];
    const p = tables.learning_paths.find((x) => x.id === t.path_id && x.user_id === v[1]);
    return p ? [{ id: t.id }] : [];
  }
  if (sql.startsWith("UPDATE path_topics SET")) {
    // dynamic SET clause: parse `col = $N` pairs
    const sets = [];
    const re = /(\w+)\s*=\s*\$(\d+)/g;
    let m;
    while ((m = re.exec(sql)) !== null) sets.push({ col: m[1], idx: Number(m[2]) - 1 });
    const whereM = sql.match(/WHERE id = \$(\d+)/);
    const idVal = whereM ? v[Number(whereM[1]) - 1] : null;
    const t = byId(tables.path_topics, idVal);
    if (t) {
      for (const s of sets) {
        if (s.col !== "id") t[s.col] = v[s.idx];
      }
    }
    return t ? [{ ...t }] : [];
  }

  // -- bookmarks ------------------------------------------------------------------
  if (sql.startsWith("SELECT * FROM bookmarks WHERE user_id =")) {
    return tables.bookmarks
      .filter((b) => b.user_id === v[0])
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((b) => ({ ...b }));
  }
  if (sql.startsWith("INSERT INTO bookmarks")) {
    const b = {
      id: randomUUID(),
      user_id: v[0],
      kind: v[1],
      ref_id: v[2],
      label: v[3],
      created_at: nowIso(),
    };
    tables.bookmarks.push(b);
    return [{ ...b }];
  }
  if (sql.startsWith("DELETE FROM bookmarks WHERE id =")) {
    const i = tables.bookmarks.findIndex((x) => x.id === v[0] && x.user_id === v[1]);
    if (i < 0) return [];
    return [{ id: tables.bookmarks.splice(i, 1)[0].id }];
  }

  // -- study extras -----------------------------------------------------------------
  if (sql.startsWith("INSERT INTO focus_sessions")) {
    tables.focus_sessions.push({
      id: randomUUID(),
      user_id: v[0],
      minutes: v[1],
      xp: v[2],
      completed_at: nowIso(),
    });
    return [];
  }
  if (sql.startsWith("SELECT to_char(reviewed_at,")) {
    const since = v[1];
    const counts = new Map();
    for (const r of tables.review_logs) {
      if (r.user_id === v[0] && r.reviewed_at >= since) {
        const d = dayOf(r.reviewed_at);
        counts.set(d, (counts.get(d) || 0) + 1);
      }
    }
    return [...counts].map(([day, n]) => ({ day, n }));
  }
  if (sql.startsWith("SELECT to_char(completed_at,")) {
    const since = v[1];
    const counts = new Map();
    for (const s of tables.focus_sessions) {
      if (s.user_id === v[0] && s.completed_at >= since) {
        const d = dayOf(s.completed_at);
        counts.set(d, (counts.get(d) || 0) + 1);
      }
    }
    return [...counts].map(([day, n]) => ({ day, n }));
  }
  if (sql.startsWith("SELECT COALESCE(SUM(minutes),0)")) {
    const today = dayOf(nowIso());
    let minutes = 0;
    let xp = 0;
    for (const s of tables.focus_sessions) {
      if (s.user_id === v[0] && dayOf(s.completed_at) === today) {
        minutes += s.minutes;
        xp += s.xp;
      }
    }
    return [{ minutes, xp }];
  }
  if (sql.startsWith("SELECT COUNT(*)::int AS n FROM focus_sessions")) {
    const since = v[1];
    return [
      {
        n: tables.focus_sessions.filter(
          (s) => s.user_id === v[0] && s.completed_at >= since,
        ).length,
      },
    ];
  }

  // -- unknown ------------------------------------------------------------------------
  console.warn("[memory-db] unhandled query:", sql.slice(0, 120));
  return [];
}

/**
 * Template-tag interface matching the Neon driver: memoryDb`... ${val} ...`
 */
function memoryDb(strings, ...values) {
  const sql = strings.reduce(
    (acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""),
    "",
  );
  return Promise.resolve(execute(sql, values));
}

memoryDb.unsafe = (sql, values) => Promise.resolve(execute(sql, values || []));

module.exports = { memoryDb, isDemoMode };
