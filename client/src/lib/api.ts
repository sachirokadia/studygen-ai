/** Typed fetch wrapper for the StudyGen API. Base path /api (proxied to :5000 in dev). */

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Deck {
  id: string;
  title: string;
  sourceType: string;
  sourceName?: string | null;
  summary?: string | null;
  status: string;
  createdAt: string;
  cardCount: number;
  quizCount: number;
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  easiness: number;
  interval: number;
  repetitions: number;
  dueAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  orderIndex: number;
}

export interface Quiz {
  id: string;
  deckId: string;
  title: string;
  timeLimitS?: number | null;
  createdAt: string;
  questions?: QuizQuestion[];
}

export interface AttemptAnswer {
  questionId: string;
  selected: number;
}

export interface QuizAttempt {
  id: string;
  score: number;
  total: number;
  answers: AttemptAnswer[];
  completedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type TopicStatus = "todo" | "doing" | "done";

export interface PathTopic {
  id: string;
  title: string;
  description?: string | null;
  status: TopicStatus;
  parentId?: string | null;
  orderIndex: number;
}

export interface LearningPath {
  id: string;
  title: string;
  description?: string | null;
  createdAt: string;
  topics?: PathTopic[];
}

export interface Bookmark {
  id: string;
  kind: string;
  refId: string;
  label: string;
  createdAt: string;
}

export interface TodayStats {
  dueCount: number;
  decksCount: number;
  focusMinutesToday: number;
  xpToday: number;
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface StudyPackFlashcard {
  front: string;
  back: string;
}

export interface StudyPackQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface StudyPackResult {
  deckId?: string;
  summary: string;
  flashcards: StudyPackFlashcard[];
  quiz: StudyPackQuestion[];
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface AdminStats {
  users: number;
  decks: number;
  cards: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = "studygen_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string> | undefined) ?? {}),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...opts, headers });

  if (res.status === 401) {
    setToken(null);
    if (window.location.pathname !== "/login") window.location.href = "/login";
    throw new ApiError(401, "Unauthorized");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      /* keep default message */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
