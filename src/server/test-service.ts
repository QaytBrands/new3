import "server-only";
import { randomInt } from "crypto";
import type { Test } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canAccessChapter, canAccessLesson } from "@/lib/access";
import { generateQuestions } from "@/lib/tests/generator";
import { gradeAnswer, scoreAttempt } from "@/lib/tests/grading";
import { seededRng } from "@/lib/tests/rng";
import type { PromptData, QuizVocab } from "@/lib/tests/types";
import { onDailyTestPassed, onWeeklyTestPassed } from "@/lib/progression";
import { getAccess } from "./student-data";
import { recordReview } from "./vocab-progress";

/** Seconds of network/clock slack allowed after a time limit expires. */
const GRACE_SEC = 20;

const vocabInclude = { sentences: { select: { german: true, english: true } } } as const;

export class TestAccessError extends Error {}

type TestWithScope = Test & {
  lesson: { id: string; chapterId: string; chapter: { levelId: string } } | null;
  chapter: { id: string; levelId: string; lessons: { id: string }[] } | null;
};

async function loadTest(testId: string): Promise<TestWithScope | null> {
  return prisma.test.findUnique({
    where: { id: testId },
    include: {
      lesson: { select: { id: true, chapterId: true, chapter: { select: { levelId: true } } } },
      chapter: { select: { id: true, levelId: true, lessons: { select: { id: true } } } },
    },
  });
}

export async function getTestForStudent(userId: string, testId: string) {
  const test = await loadTest(testId);
  if (!test || !test.published) return null;
  const access = await getAccess(userId);
  if (test.lesson) {
    const ok = canAccessLesson(access, { id: test.lesson.id, chapterId: test.lesson.chapterId, levelId: test.lesson.chapter.levelId });
    return ok ? test : null;
  }
  if (test.chapter) {
    const ch = test.chapter;
    const ok =
      canAccessChapter(access, { id: ch.id, levelId: ch.levelId }) ||
      ch.lessons.some((l) => canAccessLesson(access, { id: l.id, chapterId: ch.id, levelId: ch.levelId }));
    return ok ? test : null;
  }
  return null;
}

function toQuiz(v: { id: string; german: string; english: string; article: QuizVocab["article"]; ipa: string | null; phonetic: string | null; audioUrl: string | null; sentences: { german: string; english: string }[] }): QuizVocab {
  return v;
}

/** Words the test covers: daily = the lesson; weekly = lessons the student completed in the chapter. */
async function targetVocabulary(userId: string, test: TestWithScope): Promise<{ targets: QuizVocab[]; levelId: string }> {
  if (test.lesson) {
    const vocab = await prisma.vocabulary.findMany({ where: { lessonId: test.lesson.id }, include: vocabInclude });
    return { targets: vocab.map(toQuiz), levelId: test.lesson.chapter.levelId };
  }
  const ch = test.chapter!;
  const access = await getAccess(userId);
  const accessibleIds = ch.lessons
    .filter((l) => canAccessLesson(access, { id: l.id, chapterId: ch.id, levelId: ch.levelId }))
    .map((l) => l.id);
  const completed = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: accessibleIds }, status: "COMPLETED" },
    select: { lessonId: true },
  });
  const lessonIds = completed.length ? completed.map((c) => c.lessonId) : accessibleIds;
  const vocab = await prisma.vocabulary.findMany({ where: { lessonId: { in: lessonIds } }, include: vocabInclude });
  return { targets: vocab.map(toQuiz), levelId: ch.levelId };
}

/** Resumes an unfinished, unexpired attempt or creates a new one with a question snapshot. */
export async function startAttempt(userId: string, testId: string) {
  const test = await getTestForStudent(userId, testId);
  if (!test) throw new TestAccessError("Test not available.");

  const open = await prisma.testAttempt.findFirst({
    where: { userId, testId, completedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (open && !isExpired(open.startedAt, test.timeLimitSec)) return open.id;
  if (open) await finalizeAttempt(userId, open.id, {}); // time ran out: grade what was saved

  const { targets, levelId } = await targetVocabulary(userId, test);
  if (targets.length === 0) throw new TestAccessError("This test has no vocabulary yet.");
  const distractorPool = (
    await prisma.vocabulary.findMany({
      where: { lesson: { chapter: { levelId } } },
      include: vocabInclude,
      take: 300,
    })
  ).map(toQuiz);

  const questions = generateQuestions({
    targets,
    distractorPool,
    count: test.questionCount,
    types: test.questionTypes,
    randomize: test.randomize,
    rng: seededRng(randomInt(0, 2 ** 31)),
  });

  const previous = await prisma.testAttempt.count({ where: { userId, testId } });
  const attempt = await prisma.testAttempt.create({
    data: {
      userId,
      testId,
      attemptNumber: previous + 1,
      total: questions.length,
      answers: {
        create: questions.map((q, i) => ({
          position: i,
          vocabularyId: q.vocabularyId,
          questionType: q.questionType,
          prompt: q.prompt,
          promptData: q.promptData ?? undefined,
          options: q.options,
          correctAnswer: q.correctAnswer,
        })),
      },
    },
  });
  return attempt.id;
}

export function isExpired(startedAt: Date, timeLimitSec: number | null, now = new Date()) {
  return !!timeLimitSec && now.getTime() > startedAt.getTime() + (timeLimitSec + GRACE_SEC) * 1000;
}

/** Question data safe to send to the browser (no correct answers). */
export async function getAttemptForRunner(userId: string, attemptId: string) {
  const attempt = await prisma.testAttempt.findFirst({
    where: { id: attemptId, userId },
    include: {
      test: { select: { id: true, title: true, kind: true, timeLimitSec: true, passingScore: true } },
      answers: {
        orderBy: { position: "asc" },
        select: { position: true, questionType: true, prompt: true, promptData: true, options: true, vocabularyId: true },
      },
    },
  });
  if (!attempt) return null;
  return {
    ...attempt,
    answers: attempt.answers.map((a) => ({ ...a, promptData: (a.promptData as PromptData | null) ?? null })),
  };
}

/**
 * Grades an attempt on the server. `given` maps question position → answer text; for
 * pronunciation questions the value is the PronunciationAttempt id.
 */
export async function finalizeAttempt(userId: string, attemptId: string, given: Record<number, string>) {
  const now = new Date();
  const attempt = await prisma.testAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { test: true, answers: { orderBy: { position: "asc" } } },
  });
  if (!attempt) throw new TestAccessError("Attempt not found.");
  if (attempt.completedAt) return attempt;

  // Answers submitted after the time limit (plus grace) are discarded.
  const late = isExpired(attempt.startedAt, attempt.test.timeLimitSec, now);
  const answers = late ? {} : given;

  const pronunciationIds = attempt.answers
    .filter((a) => a.questionType === "PRONUNCIATION" && answers[a.position])
    .map((a) => answers[a.position]);
  const ownedRecordings = new Map(
    (
      await prisma.pronunciationAttempt.findMany({
        where: { id: { in: pronunciationIds }, userId, testAnswer: null },
        select: { id: true, vocabularyId: true, transcript: true },
      })
    ).map((p) => [p.id, p]),
  );

  const results = attempt.answers.map((a) => {
    const raw = answers[a.position] ?? null;
    if (a.questionType === "PRONUNCIATION") {
      const rec = raw ? ownedRecordings.get(raw) : undefined;
      const valid = rec && rec.vocabularyId === a.vocabularyId ? rec : undefined;
      return { a, givenAnswer: valid ? valid.transcript ?? "(recorded)" : null, isCorrect: null, recordingId: valid?.id ?? null };
    }
    const givenAnswer = raw?.slice(0, 300) ?? null;
    return { a, givenAnswer, isCorrect: gradeAnswer(a, givenAnswer), recordingId: null };
  });

  const score = scoreAttempt(results.map((r) => r.isCorrect), attempt.test.passingScore);
  const durationSec = Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000);

  const updated = await prisma.$transaction(async (tx) => {
    // Guard against double submission: only the first finalize wins.
    const claimed = await tx.testAttempt.updateMany({
      where: { id: attempt.id, completedAt: null },
      data: { completedAt: now, durationSec, ...score },
    });
    if (claimed.count === 0) return tx.testAttempt.findUniqueOrThrow({ where: { id: attempt.id } });

    for (const r of results) {
      await tx.testAnswer.update({
        where: { id: r.a.id },
        data: { givenAnswer: r.givenAnswer, isCorrect: r.isCorrect, pronunciationAttemptId: r.recordingId },
      });
      if (r.isCorrect !== null) await recordReview(tx, userId, r.a.vocabularyId, r.isCorrect, now);
    }
    if (score.passed) {
      if (attempt.test.kind === "DAILY" && attempt.test.lessonId) await onDailyTestPassed(tx, userId, attempt.test.lessonId);
      if (attempt.test.kind === "WEEKLY" && attempt.test.chapterId) await onWeeklyTestPassed(tx, userId, attempt.test.chapterId);
    }
    return tx.testAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
  }, { timeout: 20_000 });
  return updated;
}
