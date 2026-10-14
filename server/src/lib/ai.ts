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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Raw text completion. Retries rate limits and transient provider errors. */
export async function chatCompletion(opts: CompletionOptions): Promise<string> {
  const { apiKey, baseUrl, model } = aiConfig();
  const reqBody = JSON.stringify({
    model,
    messages: opts.messages,
    ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  });
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: reqBody,
      });
    } catch (e) {
      lastErr = new HttpError(502, `AI provider unreachable: ${(e as Error)?.message || e}`);
      if (attempt < 2) await sleep(1000 * (attempt + 1));
      continue;
    }

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        // Groq intermittently returns 200 with empty content when throttled — retry it
        lastErr = new HttpError(502, "AI provider returned an empty response.");
        if (attempt < 2) await sleep(1000 * (attempt + 1));
        continue;
      }
      return content;
    }

    const body = await res.text().catch(() => "");
    // retry on rate limits and server errors; fail fast on client errors
    if (res.status === 429 || res.status >= 500) {
      lastErr = new HttpError(res.status, `AI provider error (${res.status}): ${body.slice(0, 300)}`);
      if (attempt < 2) await sleep(1000 * (attempt + 1));
      continue;
    }
    throw new HttpError(res.status, `AI provider error (${res.status}): ${body.slice(0, 300)}`);
  }
  throw lastErr;
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
  eli5: "You are explaining to a 5-year-old child. STRICT RULES: use only tiny everyday words a small child already knows. NEVER use technical terms — if a hard idea must be named, swap it for a toy, food, or playground comparison instead. Keep every sentence under 12 words. Use 2-3 fun analogies. Keep the whole answer under 150 words. Cheerful, playful tone. Simple markdown ok.",
  simple:
    "You are explaining to a school student with no background in this topic. RULES: use plain everyday language; every technical term must be defined in the same sentence where it first appears. Give exactly one concrete real-life example. Organize into 2-4 short sections with bold headings. Aim for 200-300 words. Friendly tutor tone. Markdown allowed.",
  detailed:
    "You are explaining to an advanced student who wants real depth. RULES: use precise technical terminology and use it correctly. Explain mechanisms and WHY things work, not just what happens. Cover nuances, edge cases, common misconceptions, and connections to 2-3 related ideas. Organize with clear markdown sections and headings. Be thorough — do not oversimplify, length is fine. Markdown allowed.",
};

/** Explain a topic at the requested level. Returns markdown. */
export async function explainTopic(topic: string, level: ExplainLevel = "simple"): Promise<string> {
  // Headroom matters: gpt-oss is a reasoning model and burns tokens on internal
  // thinking before answering. Too small a cap = thinking eats the whole
  // budget and Groq returns 200 with empty content.
  const maxTokens = { eli5: 1000, simple: 1500, detailed: 2000 }[level];
  return chatCompletion({
    messages: [
      { role: "system", content: EXPLAIN_SYSTEM[level] },
      { role: "user", content: `Explain this topic:\n${topic.slice(0, 2000)}` },
    ],
    temperature: 0.7,
    maxTokens,
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
