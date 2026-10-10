/**
 * SM-2 spaced repetition (Anki-style).
 * grade: 1 = again (forgot), 2 = hard, 3 = good, 4 = easy.
 */
export type Sm2CardState = {
  easiness: number;
  interval: number; // days
  repetitions: number;
};

export type Sm2Result = Sm2CardState & {
  dueAt: Date;
};

const MIN_EASINESS = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function sm2(card: Sm2CardState, grade: 1 | 2 | 3 | 4, now = new Date()): Sm2Result {
  let { easiness, interval, repetitions } = card;

  if (grade === 1) {
    repetitions = 0;
    interval = 1;
    easiness = Math.max(MIN_EASINESS, easiness - 0.2);
  } else if (grade === 2) {
    repetitions = 0;
    interval = 1;
    easiness = Math.max(MIN_EASINESS, easiness - 0.15);
  } else {
    // grade 3 (good) or 4 (easy): advance the repetition chain
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(interval * easiness));
    }
    if (grade === 4) {
      easiness += 0.1;
    }
  }

  return {
    easiness: Math.round(easiness * 100) / 100,
    interval,
    repetitions,
    dueAt: new Date(now.getTime() + interval * DAY_MS),
  };
}

/** Convenience: default state for a brand-new card. */
export function newCardState(): Sm2CardState {
  return { easiness: 2.5, interval: 0, repetitions: 0 };
}
