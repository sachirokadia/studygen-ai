import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "../server/src/db/schema.ts",
  out: "./",
  dbCredentials: {
    // Only used by `drizzle-kit generate` (no live connection needed).
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/unset",
  },
});
