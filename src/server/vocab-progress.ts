import "server-only";
import type { Prisma } from "@prisma/client";
import { applyReview } from "@/lib/srs";

/** Records a graded review for a word, creating its progress row if needed. */
export async function recordReview(
  tx: Prisma.TransactionClient,
  userId: string,
  vocabularyId: string,
  correct: boolean,
  now: Date,
  timeZone: string,
) {
  const current = await tx.vocabularyProgress.findUnique({ where: { userId_vocabularyId: { userId, vocabularyId } } });
  const r = applyReview(
    current ?? { timesSeen: 0, timesCorrect: 0, timesIncorrect: 0, easeFactor: 2.5, intervalDays: 0, repetitions: 0 },
    correct,
    now,
    timeZone,
  );
  const data = {
    timesSeen: r.timesSeen,
    timesCorrect: r.timesCorrect,
    timesIncorrect: r.timesIncorrect,
    easeFactor: r.easeFactor,
    intervalDays: r.intervalDays,
    repetitions: r.repetitions,
    mastery: r.mastery,
    lastReviewedAt: r.lastReviewedAt,
    nextReviewAt: r.nextReviewAt,
    ...(r.lastIncorrectAt ? { lastIncorrectAt: r.lastIncorrectAt } : {}),
  };
  await tx.vocabularyProgress.upsert({
    where: { userId_vocabularyId: { userId, vocabularyId } },
    create: { userId, vocabularyId, ...data },
    update: data,
  });
}
