# StudyGen AI

Turn anything into study material and actually remember it. Paste a PDF, drop a
YouTube link, or type a topic — AI builds your summary, flashcards, and quizzes.
Spaced repetition (SM-2) and focus tools make it stick.

## Stack

- **Client:** React + Vite + TypeScript + TailwindCSS (in `client/`)
- **Server:** Express + TypeScript, serverless via Vercel (`server/` + `api/`)
- **DB:** Neon Postgres via Drizzle ORM (`drizzle/` migrations)

## Quick start

```bash
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, AI_*
npm install
npm run db:migrate          # apply drizzle migrations
npm run dev:server          # API on :5000
# in another shell:
cd client && npm run dev    # app on :5173
```

## Env vars

See `.env.example`. `AI_API_KEY` is optional — AI endpoints return 503 without it;
everything else works.

## Deploy (Vercel)

Connect the repo; `vercel.json` handles the rest:
- builds client → `client/dist`
- `/api/*` → serverless Express app (`api/index.ts`)
