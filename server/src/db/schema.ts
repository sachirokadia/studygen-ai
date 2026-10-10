import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Users. role: 'user' | 'admin'. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Study decks. sourceType: 'pdf' | 'youtube' | 'text' | 'topic'. */
export const decks = pgTable("decks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sourceType: text("source_type").notNull(),
  sourceName: text("source_name"),
  summary: text("summary"),
  status: text("status").notNull().default("ready"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Flashcards with SM-2 scheduling state. */
export const flashcards = pgTable("flashcards", {
  id: uuid("id").primaryKey().defaultRandom(),
  deckId: uuid("deck_id")
    .notNull()
    .references(() => decks.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  easiness: real("easiness").notNull().default(2.5),
  interval: integer("interval").notNull().default(0),
  repetitions: integer("repetitions").notNull().default(0),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Quizzes belonging to a deck. */
export const quizzes = pgTable("quizzes", {
  id: uuid("id").primaryKey().defaultRandom(),
  deckId: uuid("deck_id")
    .notNull()
    .references(() => decks.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  timeLimitS: integer("time_limit_s"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuizOption = string;

/** MCQ questions. options: exactly 4 strings. */
export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options").$type<QuizOption[]>().notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation").notNull().default(""),
  orderIndex: integer("order_index").notNull().default(0),
});

/** One completed quiz attempt. answers: [{questionId, selected}]. */
export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  answers: jsonb("answers")
    .$type<Array<{ questionId: string; selected: number }>>()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Free-form notes. */
export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Saved references. kind: 'deck' | 'note' | 'path' | 'url'. */
export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  refId: text("ref_id").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One flashcard review event (drives heatmap + stats). */
export const reviewLogs = pgTable("review_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cardId: uuid("card_id")
    .notNull()
    .references(() => flashcards.id, { onDelete: "cascade" }),
  grade: integer("grade").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Completed Pomodoro/focus sessions. */
export const focusSessions = pgTable("focus_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  minutes: integer("minutes").notNull(),
  xp: integer("xp").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Visual learning paths. */
export const learningPaths = pgTable("learning_paths", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Topics inside a path. status: 'todo' | 'doing' | 'done'. */
export const pathTopics = pgTable("path_topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  pathId: uuid("path_id")
    .notNull()
    .references(() => learningPaths.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  orderIndex: integer("order_index").notNull().default(0),
  parentId: uuid("parent_id"),
});

// ---------------------------------------------------------------- relations

export const usersRelations = relations(users, ({ many }) => ({
  decks: many(decks),
  flashcards: many(flashcards),
  quizzes: many(quizzes),
  notes: many(notes),
  bookmarks: many(bookmarks),
  reviewLogs: many(reviewLogs),
  focusSessions: many(focusSessions),
  learningPaths: many(learningPaths),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  user: one(users, { fields: [decks.userId], references: [users.id] }),
  flashcards: many(flashcards),
  quizzes: many(quizzes),
}));

export const flashcardsRelations = relations(flashcards, ({ one, many }) => ({
  deck: one(decks, { fields: [flashcards.deckId], references: [decks.id] }),
  user: one(users, { fields: [flashcards.userId], references: [users.id] }),
  reviewLogs: many(reviewLogs),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  deck: one(decks, { fields: [quizzes.deckId], references: [decks.id] }),
  user: one(users, { fields: [quizzes.userId], references: [users.id] }),
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, { fields: [quizQuestions.quizId], references: [quizzes.id] }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  quiz: one(quizzes, { fields: [quizAttempts.quizId], references: [quizzes.id] }),
  user: one(users, { fields: [quizAttempts.userId], references: [users.id] }),
}));

export const learningPathsRelations = relations(learningPaths, ({ one, many }) => ({
  user: one(users, { fields: [learningPaths.userId], references: [users.id] }),
  topics: many(pathTopics),
}));

export const pathTopicsRelations = relations(pathTopics, ({ one }) => ({
  path: one(learningPaths, { fields: [pathTopics.pathId], references: [learningPaths.id] }),
}));

// ------------------------------------------------------------ inferred types

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Deck = typeof decks.$inferSelect;
export type Flashcard = typeof flashcards.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type LearningPath = typeof learningPaths.$inferSelect;
export type PathTopic = typeof pathTopics.$inferSelect;
