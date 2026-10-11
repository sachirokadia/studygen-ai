/**
 * Anki .apkg export — client-side generation.
 *
 * An .apkg is a ZIP containing:
 *   - collection.anki2  (SQLite database, Anki 2.1 schema)
 *   - media             (JSON map, empty here)
 *
 * Loaded on demand (dynamic import) so sql.js (~1MB WASM) never
 * touches the main bundle.
 */
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import JSZip from "jszip";

export interface AnkiCard {
  front: string;
  back: string;
}

const MODEL_ID = 1750000000000;
const DECK_ID = 1;

// Anki base91 alphabet for guids
const B91 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~";
function guid(): string {
  let s = "";
  for (let i = 0; i < 10; i++) s += B91[Math.floor(Math.random() * B91.length)];
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function stripCloze(s: string): string {
  return s.replace(/\{\{c\d+::([^}:]+?)(?:::([^}]+?))?\}\}/g, "$1");
}

const SCHEMA = `
CREATE TABLE col (
  id INTEGER PRIMARY KEY,
  crt INTEGER NOT NULL,
  mod INTEGER NOT NULL,
  scm INTEGER NOT NULL,
  ver INTEGER NOT NULL,
  dty INTEGER NOT NULL,
  usn INTEGER NOT NULL,
  ls INTEGER NOT NULL,
  conf TEXT NOT NULL,
  models TEXT NOT NULL,
  decks TEXT NOT NULL,
  dconf TEXT NOT NULL,
  tags TEXT NOT NULL
);
CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  guid TEXT NOT NULL,
  mid INTEGER NOT NULL,
  mod INTEGER NOT NULL,
  usn INTEGER NOT NULL,
  tags TEXT NOT NULL,
  flds TEXT NOT NULL,
  sfld INTEGER NOT NULL,
  csum INTEGER NOT NULL,
  flags INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE cards (
  id INTEGER PRIMARY KEY,
  nid INTEGER NOT NULL,
  did INTEGER NOT NULL,
  ord INTEGER NOT NULL,
  mod INTEGER NOT NULL,
  usn INTEGER NOT NULL,
  type INTEGER NOT NULL,
  queue INTEGER NOT NULL,
  due INTEGER NOT NULL,
  ivl INTEGER NOT NULL,
  factor INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  lapses INTEGER NOT NULL,
  left INTEGER NOT NULL,
  odue INTEGER NOT NULL,
  odid INTEGER NOT NULL,
  flags INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE revlog (
  id INTEGER PRIMARY KEY,
  cid INTEGER NOT NULL,
  usn INTEGER NOT NULL,
  ease INTEGER NOT NULL,
  ivl INTEGER NOT NULL,
  lastIvl INTEGER NOT NULL,
  factor INTEGER NOT NULL,
  time INTEGER NOT NULL,
  type INTEGER NOT NULL
);
CREATE TABLE graves (
  oid INTEGER PRIMARY KEY,
  type INTEGER NOT NULL,
  usn INTEGER NOT NULL
);
CREATE INDEX ix_notes_usn ON notes (usn);
CREATE INDEX ix_cards_usn ON cards (usn);
CREATE INDEX ix_cards_nid ON cards (nid);
CREATE INDEX ix_cards_sched ON cards (did, queue, due);
CREATE INDEX ix_revlog_usn ON revlog (usn);
CREATE INDEX ix_revlog_cid ON revlog (cid);
`;

function buildColRow(deckName: string, nowMs: number): Record<string, SqlValue> {
  const models = {
    [String(MODEL_ID)]: {
      id: MODEL_ID,
      name: "Basic",
      type: 0,
      mod: Math.floor(nowMs / 1000),
      usn: 0,
      sortf: 0,
      did: DECK_ID,
      tmpls: [
        {
          name: "Card 1",
          ord: 0,
          qfmt: "{{Front}}",
          afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
          bqfmt: "",
          bafmt: "",
          did: null,
          bfont: "",
          bsize: 0,
        },
      ],
      flds: [
        { name: "Front", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20 },
        { name: "Back", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20 },
      ],
      css: ".card {\n font-family: arial;\n font-size: 20px;\n text-align: center;\n color: black;\n background-color: white;\n}",
      req: [[0, "any", [0]]],
    },
  };
  const decks = {
    [String(DECK_ID)]: {
      id: DECK_ID,
      mod: Math.floor(nowMs / 1000),
      name: deckName,
      usn: 0,
      lrnToday: [0, 0],
      revToday: [0, 0],
      newToday: [0, 0],
      timeToday: [0, 0],
      collapsed: false,
      browserCollapsed: false,
      desc: "",
      dyn: 0,
      conf: 1,
      extendNew: 10,
      extendRev: 50,
    },
  };
  const dconf = {
    "1": {
      id: 1,
      mod: 0,
      name: "Default",
      usn: 0,
      maxTaken: 60,
      autoplay: true,
      timer: 0,
      replayq: true,
      new: {
        perDay: 20,
        delays: [1, 10],
        ints: [1, 4, 7],
        initialFactor: 2500,
        separate: true,
        order: 1,
        bury: false,
      },
      lapse: {
        delays: [10],
        mult: 0,
        minInt: 1,
        leechFails: 8,
        leechAction: 0,
      },
      rev: {
        perDay: 200,
        ease4: 1.3,
        fuzz: 0.05,
        minSpace: 1,
        ivlFct: 1,
        maxIvl: 36500,
        bury: false,
        hardFactor: 1.2,
      },
      dyn: false,
    },
  };
  const conf = {
    nextPos: 1,
    estTimes: true,
    activeDecks: [DECK_ID],
    sortType: "noteFld",
    timeLim: 0,
    sortBackwards: false,
    addToCur: true,
    curDeck: DECK_ID,
    newBury: true,
    newSpread: 0,
    dueCounts: true,
    curModel: String(MODEL_ID),
    collapseTime: 1200,
  };
  return {
    id: 1,
    crt: Math.floor(nowMs / 1000),
    mod: Math.floor(nowMs / 1000),
    scm: Math.floor(nowMs / 1000),
    ver: 11,
    dty: 0,
    usn: 0,
    ls: 0,
    conf: JSON.stringify(conf),
    models: JSON.stringify(models),
    decks: JSON.stringify(decks),
    dconf: JSON.stringify(dconf),
    tags: JSON.stringify({}),
  };
}

/** Generate a real .apkg file and trigger a download. */
export async function exportApkg(deckTitle: string, cards: AnkiCard[]): Promise<void> {
  if (cards.length === 0) throw new Error("no cards");

  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db: Database = new SQL.Database();
  db.run(SCHEMA);

  const nowMs = Date.now();
  const col = buildColRow(deckTitle, nowMs);
  db.run(
    "INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      col.id,
      col.crt,
      col.mod,
      col.scm,
      col.ver,
      col.dty,
      col.usn,
      col.ls,
      col.conf,
      col.models,
      col.decks,
      col.dconf,
      col.tags,
    ],
  );

  let idSeq = nowMs;
  const nextId = () => ++idSeq;

  for (const c of cards) {
    const front = escapeHtml(stripCloze(c.front.trim()));
    const back = escapeHtml(stripCloze(c.back.trim()));
    if (!front || !back) continue;
    const nid = nextId();
    const flds = `${front}\x1f${back}`;
    db.run(
      "INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [nid, guid(), MODEL_ID, Math.floor(nowMs / 1000), 0, "", flds, 0, 0, 0, ""],
    );
    db.run(
      "INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [nextId(), nid, DECK_ID, 0, Math.floor(nowMs / 1000), 0, 0, 0, nid, 0, 0, 0, 0, 0, 0, 0, 0, ""],
    );
  }

  const sqliteBytes = db.export();
  db.close();

  const zip = new JSZip();
  zip.file("collection.anki2", sqliteBytes);
  zip.file("media", "{}");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

  const safeName = deckTitle.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "cards";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.apkg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
