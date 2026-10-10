/** Seed a demo user + sample deck. Usage: npm run seed (needs DATABASE_URL). */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { decks, flashcards, users } from "./db/schema.js";
import { hashPassword } from "./lib/auth.js";
import { newCardState } from "./lib/sm2.js";

const DEMO_EMAIL = "demo@studygen.ai";

async function main(): Promise<void> {
  const existing = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  let userId: string;
  if (existing[0]) {
    userId = existing[0].id;
    console.log("Demo user already exists, reusing.");
  } else {
    const inserted = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        passwordHash: await hashPassword("studygen-demo"),
        name: "Demo Student",
      })
      .returning({ id: users.id });
    userId = inserted[0]?.id ?? "";
    console.log("Created demo user:", DEMO_EMAIL, "(password: studygen-demo)");
  }

  const deckRows = await db
    .insert(decks)
    .values({
      userId,
      title: "Photosynthesis — Sample Deck",
      sourceType: "topic",
      summary:
        "- Photosynthesis converts light energy into chemical energy.\n- Occurs in chloroplasts, mainly in leaf mesophyll cells.\n- Key insight: it powers almost all life on Earth, directly or indirectly.",
      status: "ready",
    })
    .returning();
  const deck = deckRows[0];
  if (!deck) throw new Error("Failed to create sample deck");

  const state = newCardState();
  const cards = [
    { front: "Where does photosynthesis occur?", back: "In chloroplasts, mainly in leaf mesophyll cells." },
    { front: "What are the inputs of photosynthesis?", back: "Carbon dioxide + water + light energy." },
    { front: "What are the outputs of photosynthesis?", back: "Glucose + oxygen." },
  ];
  await db.insert(flashcards).values(
    cards.map((c, i) => ({ userId, deckId: deck.id, ...c, orderIndex: i, ...state })),
  );

  console.log(`Seeded deck "${deck.title}" with ${cards.length} cards.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
