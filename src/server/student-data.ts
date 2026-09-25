import "server-only";
import { prisma } from "@/lib/db";
import { zonedDayRange } from "@/lib/time";
import { buildAccessSet, canAccessChapter, canAccessLesson, visibleLevelIds, type AccessSet } from "@/lib/access";

export async function getAccess(userId: string): Promise<AccessSet> {
  const unlocks = await prisma.unlock.findMany({ where: { userId } });
  return buildAccessSet(unlocks);
}

export type TestStatus = { id: string; title: string; passed: boolean; attempts: number; bestPercentage: number | null } | null;

export type LessonNode = {
  id: string;
  dayNumber: number;
  title: string;
  accessible: boolean;
  wordCount: number;
  seenCount: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  dailyTest: TestStatus;
};

export type ChapterNode = {
  id: string;
  title: string;
  order: number;
  accessible: boolean;
  lessons: LessonNode[];
  weeklyTest: TestStatus;
};

export type LevelNode = { id: string; code: string; name: string; chapters: ChapterNode[] };

/** Curriculum tree limited to levels the student can see, annotated with access and progress. */
export async function getStudentCurriculum(userId: string): Promise<LevelNode[]> {
  const [access, levels, lessonProgress, attempts] = await Promise.all([
    getAccess(userId),
    prisma.level.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
      include: {
        chapters: {
          orderBy: { order: "asc" },
          include: {
            tests: { where: { published: true, kind: "WEEKLY" }, orderBy: { createdAt: "asc" } },
            lessons: {
              orderBy: [{ order: "asc" }, { dayNumber: "asc" }],
              include: {
                _count: { select: { vocabulary: true } },
                tests: { where: { published: true, kind: "DAILY" }, orderBy: { createdAt: "asc" } },
              },
            },
          },
        },
      },
    }),
    prisma.lessonProgress.findMany({ where: { userId } }),
    prisma.testAttempt.findMany({
      where: { userId, completedAt: { not: null } },
      select: { testId: true, passed: true, percentage: true },
    }),
  ]);

  const progressByLesson = new Map(lessonProgress.map((p) => [p.lessonId, p]));
  const testStats = new Map<string, { passed: boolean; attempts: number; best: number | null }>();
  for (const a of attempts) {
    const s = testStats.get(a.testId) ?? { passed: false, attempts: 0, best: null };
    s.attempts += 1;
    s.passed ||= !!a.passed;
    s.best = Math.max(s.best ?? 0, a.percentage ?? 0);
    testStats.set(a.testId, s);
  }
  const status = (t: { id: string; title: string } | undefined): TestStatus => {
    if (!t) return null;
    const s = testStats.get(t.id);
    return { id: t.id, title: t.title, passed: s?.passed ?? false, attempts: s?.attempts ?? 0, bestPercentage: s?.best ?? null };
  };

  const chapterLevel = new Map<string, string>();
  const lessonLevel = new Map<string, string>();
  for (const l of levels)
    for (const c of l.chapters) {
      chapterLevel.set(c.id, l.id);
      for (const les of c.lessons) lessonLevel.set(les.id, l.id);
    }
  const visible = visibleLevelIds(access, chapterLevel, lessonLevel);

  return levels
    .filter((l) => visible.has(l.id))
    .map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      chapters: l.chapters.map((c) => {
        const lessons: LessonNode[] = c.lessons.map((les) => {
          const p = progressByLesson.get(les.id);
          return {
            id: les.id,
            dayNumber: les.dayNumber,
            title: les.title,
            accessible: canAccessLesson(access, { id: les.id, chapterId: c.id, levelId: l.id }),
            wordCount: les._count.vocabulary,
            seenCount: p?.seenVocabularyIds.length ?? 0,
            status: p?.status ?? "NOT_STARTED",
            dailyTest: status(les.tests[0]),
          };
        });
        return {
          id: c.id,
          title: c.title,
          order: c.order,
          accessible: canAccessChapter(access, { id: c.id, levelId: l.id }) || lessons.some((x) => x.accessible),
          lessons,
          weeklyTest: status(c.tests[0]),
        };
      }),
    }));
}

export type NextActivity =
  | { kind: "lesson"; href: string; label: string; lesson: LessonNode; chapter: ChapterNode; level: LevelNode }
  | { kind: "daily-test"; href: string; label: string; lesson: LessonNode; chapter: ChapterNode; level: LevelNode }
  | { kind: "weekly-test"; href: string; label: string; chapter: ChapterNode; level: LevelNode }
  | { kind: "review"; href: string; label: string }
  | { kind: "done"; href: string; label: string };

/** The single next thing the student should do, walking the curriculum in order. */
export function findNextActivity(levels: LevelNode[], hasRevision: boolean): NextActivity {
  for (const level of levels) {
    for (const chapter of level.chapters) {
      const lessons = chapter.lessons.filter((l) => l.accessible);
      for (const lesson of lessons) {
        if (lesson.status !== "COMPLETED") {
          return {
            kind: "lesson",
            href: `/lessons/${lesson.id}`,
            label: lesson.status === "IN_PROGRESS" ? `Continue Day ${lesson.dayNumber}` : `Start Day ${lesson.dayNumber}`,
            lesson, chapter, level,
          };
        }
        if (lesson.dailyTest && !lesson.dailyTest.passed) {
          return { kind: "daily-test", href: `/tests/${lesson.dailyTest.id}`, label: `Take Day ${lesson.dayNumber} test`, lesson, chapter, level };
        }
      }
      if (lessons.length > 0 && chapter.weeklyTest && !chapter.weeklyTest.passed && lessons.length === chapter.lessons.length) {
        return { kind: "weekly-test", href: `/tests/${chapter.weeklyTest.id}`, label: "Take the weekly test", chapter, level };
      }
    }
  }
  if (hasRevision) return { kind: "review", href: "/words?filter=review", label: "Review your words" };
  return { kind: "done", href: "/progress", label: "View your progress" };
}

/** Words due by the end of the student's local day, plus words marked difficult. */
export async function getRevisionWords(userId: string, timeZone: string, now = new Date(), limit = 8) {
  const { end } = zonedDayRange(now, timeZone);
  return prisma.vocabularyProgress.findMany({
    where: { userId, OR: [{ nextReviewAt: { lt: end } }, { difficult: true }] },
    orderBy: [{ difficult: "desc" }, { nextReviewAt: "asc" }],
    take: limit,
    include: { vocabulary: { select: { id: true, german: true, english: true, article: true, nativeAudioUrl: true } } },
  });
}

export async function getRecentMistakes(userId: string, limit = 6) {
  const rows = await prisma.testAnswer.findMany({
    where: { isCorrect: false, attempt: { userId, completedAt: { not: null } } },
    orderBy: { attempt: { completedAt: "desc" } },
    take: 40,
    include: { vocabulary: { select: { id: true, german: true, english: true, article: true } } },
  });
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.vocabularyId) ? false : (seen.add(r.vocabularyId), true))).slice(0, limit);
}

/** Mastery across all vocabulary the student can access (unseen words count as 0). */
export async function getMasterySummary(userId: string, levels: LevelNode[]) {
  const lessonIds = levels.flatMap((l) => l.chapters.flatMap((c) => c.lessons.filter((x) => x.accessible).map((x) => x.id)));
  const [total, progress] = await Promise.all([
    prisma.vocabulary.count({ where: { lessonId: { in: lessonIds } } }),
    prisma.vocabularyProgress.findMany({
      where: { userId, vocabulary: { lessonId: { in: lessonIds } } },
      select: { mastery: true, timesSeen: true },
    }),
  ]);
  const sum = progress.reduce((a, p) => a + p.mastery, 0);
  return {
    totalWords: total,
    seenWords: progress.filter((p) => p.timesSeen > 0).length,
    masteredWords: progress.filter((p) => p.mastery >= 0.8).length,
    averageMastery: total ? sum / total : 0,
  };
}

/** Loads a lesson after verifying the student can access it; returns null otherwise. */
export async function getAccessibleLesson(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: { include: { level: true } },
      tests: { where: { published: true, kind: "DAILY" }, take: 1 },
      vocabulary: {
        orderBy: { order: "asc" },
        include: { sentences: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!lesson || !lesson.chapter.level.published) return null;
  const access = await getAccess(userId);
  if (!canAccessLesson(access, { id: lesson.id, chapterId: lesson.chapterId, levelId: lesson.chapter.levelId })) return null;
  return lesson;
}

export async function assertVocabularyAccess(userId: string, vocabularyId: string) {
  const v = await prisma.vocabulary.findUnique({
    where: { id: vocabularyId },
    select: { id: true, german: true, article: true, lessonId: true, lesson: { select: { chapterId: true, chapter: { select: { levelId: true, level: { select: { published: true } } } } } } },
  });
  if (!v || !v.lesson.chapter.level.published) return null;
  const access = await getAccess(userId);
  const ok = canAccessLesson(access, { id: v.lessonId, chapterId: v.lesson.chapterId, levelId: v.lesson.chapter.levelId });
  return ok ? v : null;
}

/** Activity within the student's local calendar day. */
export async function getStudentToday(userId: string, timeZone: string, now = new Date()) {
  const { start, end } = zonedDayRange(now, timeZone);
  const [lessonsCompleted, testsCompleted, testsPassed, reviewsDue] = await Promise.all([
    prisma.lessonProgress.count({ where: { userId, completedAt: { gte: start, lt: end } } }),
    prisma.testAttempt.count({ where: { userId, completedAt: { gte: start, lt: end } } }),
    prisma.testAttempt.count({ where: { userId, completedAt: { gte: start, lt: end }, passed: true } }),
    prisma.vocabularyProgress.count({ where: { userId, nextReviewAt: { lt: end } } }),
  ]);
  return { lessonsCompleted, testsCompleted, testsPassed, reviewsDue };
}
