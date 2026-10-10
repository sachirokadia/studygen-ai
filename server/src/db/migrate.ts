/** drizzle-kit migration runner (local dev). Usage: npm run db:migrate */
import "dotenv/config";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "./client.js";

async function main(): Promise<void> {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
