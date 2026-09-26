import { DEFAULT_TIMEZONE, startOfZonedDay } from "@/lib/time";

/**
 * Review scheduling. v1 is a simplified SM-2 so the stored fields (easeFactor, intervalDays,
 * repetitions, nextReviewAt) are already compatible with a full spaced-repetition scheduler.
 */
export type SrsState = {
  timesSeen: number;
  timesCorrect: number;
  timesIncorrect: number;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
};

export type ReviewResult = SrsState & {
  mastery: number;
  lastReviewedAt: Date;
  nextReviewAt: Date;
  lastIncorrectAt?: Date;
};

export function computeMastery(s: Pick<SrsState, "timesCorrect" | "timesIncorrect" | "repetitions">) {
  const answered = s.timesCorrect + s.timesIncorrect;
  if (answered === 0) return 0;
  // Accuracy weighted by confidence (more answers → closer to raw accuracy),
  // boosted by a streak of consecutive correct reviews.
  const accuracy = s.timesCorrect / answered;
  const confidence = Math.min(1, answered / 5);
  const streak = Math.min(1, s.repetitions / 4);
  return Math.round(Math.min(1, accuracy * confidence * 0.8 + streak * 0.2) * 100) / 100;
}

/**
 * Applies a graded review. Correct answers schedule the next review for local midnight
 * `intervalDays` calendar days later in the student's time zone, so a word becomes due at the
 * start of the student's day rather than at an arbitrary UTC time. Incorrect answers are due now.
 */
export function applyReview(state: SrsState, correct: boolean, now = new Date(), timeZone = DEFAULT_TIMEZONE): ReviewResult {
  const next: SrsState = { ...state, timesSeen: state.timesSeen + 1 };
  let lastIncorrectAt: Date | undefined;
  if (correct) {
    next.timesCorrect += 1;
    next.repetitions += 1;
    next.intervalDays =
      next.repetitions === 1 ? 1 : next.repetitions === 2 ? 3 : Math.round(state.intervalDays * state.easeFactor);
    next.easeFactor = Math.min(3, state.easeFactor + 0.05);
  } else {
    next.timesIncorrect += 1;
    next.repetitions = 0;
    next.intervalDays = 0;
    next.easeFactor = Math.max(1.3, state.easeFactor - 0.2);
    lastIncorrectAt = now;
  }
  const nextReviewAt = correct ? startOfZonedDay(now, timeZone, Math.max(1, Math.ceil(next.intervalDays))) : now;
  return { ...next, mastery: computeMastery(next), lastReviewedAt: now, nextReviewAt, lastIncorrectAt };
}
