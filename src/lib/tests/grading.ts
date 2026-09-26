import type { QuestionType } from "@prisma/client";

const ARTICLES = /^(der|die|das|ein|eine)\s+/i;

/** Normalise a typed German answer: trims, collapses spaces, folds umlaut spellings (ae→ä, ss→ß). */
export function normalizeGerman(input: string, { foldUmlauts = true } = {}): string {
  let s = input.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
  s = s.replace(ARTICLES, "");
  if (foldUmlauts) {
    s = s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  }
  return s;
}

export function isGradable(type: QuestionType): boolean {
  // Pronunciation is never auto-graded without a real scoring provider.
  return type !== "PRONUNCIATION";
}

export function gradeAnswer(
  q: { questionType: QuestionType; correctAnswer: string },
  given: string | null | undefined,
): boolean | null {
  if (!isGradable(q.questionType)) return null;
  if (given == null || given.trim() === "") return false;
  if (q.questionType === "SPELLING") {
    return normalizeGerman(given) === normalizeGerman(q.correctAnswer);
  }
  return given.trim() === q.correctAnswer.trim();
}

export type AttemptScore = {
  score: number;
  total: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  passed: boolean;
};

/** Score only gradable answers; ungradable ones (null) are excluded from the total. */
export function scoreAttempt(results: (boolean | null)[], passingScore: number): AttemptScore {
  const graded = results.filter((r): r is boolean => r !== null);
  const correctCount = graded.filter(Boolean).length;
  const total = graded.length;
  const percentage = total === 0 ? 0 : Math.round((correctCount / total) * 1000) / 10;
  return {
    score: correctCount,
    total,
    percentage,
    correctCount,
    incorrectCount: total - correctCount,
    passed: total > 0 && percentage >= passingScore,
  };
}
