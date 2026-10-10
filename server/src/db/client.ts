import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  // Lazy-throw only when a query runs, so `tsc` and route wiring never crash
  // without env in edge/test contexts. All handlers check via getDb().
  console.warn("[db] DATABASE_URL is not set — queries will fail until configured.");
}

const sql = neon(databaseUrl ?? "postgresql://localhost:5432/unset");

export const db = drizzle(sql, { schema });

export type Db = typeof db;
