import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Pure: given ordered siblings, return the id after `currentId`, or null if last/not found. */
export function nextInOrder<T extends { id: string }>(ordered: T[], currentId: string): T | null {
  const i = ordered.findIndex((x) => x.id === currentId);
  return i >= 0 && i < ordered.length - 1 ? ordered[i + 1] : null;
}

async function settings(db: Db) {
  return (await db.appSettings.findUnique({ where: { id: 1 } })) ?? {
    autoUnlockNextLesson: false,
    autoUnlockNextChapter: false,
  };
}

/** Daily test passed → unlock next lesson in the chapter (if enabled by the admin). */
export async function onDailyTestPassed(db: Db, userId: string, lessonId: string) {
  const s = await settings(db);
  if (!s.autoUnlockNextLesson) return null;
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { chapterId: true } });
  if (!lesson) return null;
  const siblings = await db.lesson.findMany({
    where: { chapterId: lesson.chapterId },
    orderBy: [{ order: "asc" }, { dayNumber: "asc" }],
    select: { id: true },
  });
  const next = nextInOrder(siblings, lessonId);
  if (!next) return null;
  await db.unlock.upsert({
    where: { userId_lessonId: { userId, lessonId: next.id } },
    create: { userId, scope: "LESSON", lessonId: next.id, source: "AUTO" },
    update: {},
  });
  return next.id;
}

/** Weekly test passed → unlock next chapter in the level (if enabled by the admin). */
export async function onWeeklyTestPassed(db: Db, userId: string, chapterId: string) {
  const s = await settings(db);
  if (!s.autoUnlockNextChapter) return null;
  const chapter = await db.chapter.findUnique({ where: { id: chapterId }, select: { levelId: true } });
  if (!chapter) return null;
  const siblings = await db.chapter.findMany({
    where: { levelId: chapter.levelId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const next = nextInOrder(siblings, chapterId);
  if (!next) return null;
  await db.unlock.upsert({
    where: { userId_chapterId: { userId, chapterId: next.id } },
    create: { userId, scope: "CHAPTER", chapterId: next.id, source: "AUTO" },
    update: {},
  });
  return next.id;
}
