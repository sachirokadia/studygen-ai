/**
 * AI provider — OpenAI-compatible chat completions.
 * Env: AI_API_KEY (required), AI_BASE_URL (default https://api.openai.com/v1),
 *      AI_MODEL (default gpt-4o-mini).
 * All helpers throw an HttpError(503) when AI_API_KEY is missing so routes can
 * degrade gracefully ("AI not configured").
 */

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function aiConfig(): { apiKey: string; baseUrl: string; model: string } {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, "AI not configured — set AI_API_KEY to enable AI features.");
  }
  return {
    apiKey,
    baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
  };
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type CompletionOptions = {
  messages: ChatMessage[];
  /** When set, requests a JSON object response (OpenAI response_format). */
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
};

/** Raw text completion. */
export async function chatCompletion(opts: CompletionOptions): Promise<string> {
  const { apiKey, baseUrl, model } = aiConfig();
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(res.status, `AI provider error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, "AI provider returned an empty response.");
  return content;
}

/** JSON completion: parses the model output, throws 502 on invalid JSON. */
export async function chatCompletionJson<T>(opts: CompletionOptions): Promise<T> {
  const raw = await chatCompletion({ ...opts, jsonMode: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(502, "AI provider returned invalid JSON.");
  }
}

// ------------------------------------------------------------------ prompts

export type StudyPackQuizQuestion = {
  question: string;
  options: [string, string, string, string];
  correct: number;
  explanation: string;
};

export type StudyPackFlashcard = { front: string; back: string };

export type StudyPack = {
  summary: string;
  flashcards: StudyPackFlashcard[];
  quiz: StudyPackQuizQuestion[];
};

const STUDY_PACK_SYSTEM = `You are StudyGen, an AI study companion. Given source content, produce a study pack as a single JSON object with exactly these keys:
- "summary": markdown string, 5-8 bullet points plus one "Key insight" line.
- "flashcards": array of 8-12 {"front","back"} — front is a question/prompt, back is a concise answer.
- "quiz": array of 5-8 {"question","options","correct","explanation"} — options is exactly 4 strings, correct is the 0-based index, explanation is one sentence.
Return ONLY the JSON object, no markdown fences.`;

/** Generate a full study pack from raw content. */
export async function generateStudyPack(
  title: string,
  sourceType: string,
  content: string,
): Promise<StudyPack> {
  const pack = await chatCompletionJson<StudyPack>({
    messages: [
      { role: "system", content: STUDY_PACK_SYSTEM },
      {
        role: "user",
        content: `Title: ${title}\nSource type: ${sourceType}\nContent:\n"""\n${content.slice(0, 50_000)}\n"""`,
      },
    ],
    temperature: 0.7,
    maxTokens: 4000,
  });

  // Defensive normalization so one malformed field can't break the pipeline.
  return {
    summary: typeof pack.summary === "string" ? pack.summary : "",
    flashcards: Array.isArray(pack.flashcards)
      ? pack.flashcards.filter((c) => c && typeof c.front === "string" && typeof c.back === "string")
      : [],
    quiz: Array.isArray(pack.quiz)
      ? pack.quiz.filter(
          (q) =>
            q &&
            typeof q.question === "string" &&
            Array.isArray(q.options) &&
            q.options.length === 4 &&
            typeof q.correct === "number",
        )
      : [],
  };
}

export type ExplainLevel = "eli5" | "simple" | "detailed";

const EXPLAIN_SYSTEM: Record<ExplainLevel, string> = {
  eli5: "Explain like the reader is 5 years old. Use tiny words, fun analogies, and short sentences. Markdown allowed.",
  simple:
    "Explain clearly for a beginner student. Avoid jargon, or define it when used. Use examples. Markdown allowed.",
  detailed:
    "Explain thoroughly for an advanced student. Cover nuances, edge cases, and connections to related ideas. Markdown allowed.",
};

/** Explain a topic at the requested level. Returns markdown. */
export async function explainTopic(topic: string, level: ExplainLevel = "simple"): Promise<string> {
  return chatCompletion({
    messages: [
      { role: "system", content: EXPLAIN_SYSTEM[level] },
      { role: "user", content: `Explain this topic:\n${topic.slice(0, 2000)}` },
    ],
    temperature: 0.7,
    maxTokens: 2000,
  });
}

/** Tutor chat scoped to a deck's summary. */
export async function tutorChat(
  deckSummary: string,
  messages: ChatMessage[],
): Promise<string> {
  const history = messages.slice(-20); // keep context bounded
  return chatCompletion({
    messages: [
      {
        role: "system",
        content: `You are StudyGen, a friendly tutor. Answer the student's questions using the study material below as context. If the question goes beyond the material, say so briefly and still help.\n\nSTUDY MATERIAL:\n${deckSummary.slice(0, 8000)}`,
      },
      ...history,
    ],
    temperature: 0.7,
    maxTokens: 1200,
  });
}
