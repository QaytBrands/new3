import type { Unlock } from "@prisma/client";

export type UnlockLike = Pick<Unlock, "scope" | "levelId" | "chapterId" | "lessonId">;

export type AccessSet = {
  levels: Set<string>;
  chapters: Set<string>;
  lessons: Set<string>;
};

export function buildAccessSet(unlocks: UnlockLike[]): AccessSet {
  const set: AccessSet = { levels: new Set(), chapters: new Set(), lessons: new Set() };
  for (const u of unlocks) {
    if (u.scope === "LEVEL" && u.levelId) set.levels.add(u.levelId);
    if (u.scope === "CHAPTER" && u.chapterId) set.chapters.add(u.chapterId);
    if (u.scope === "LESSON" && u.lessonId) set.lessons.add(u.lessonId);
  }
  return set;
}

/** A level unlock grants the whole level; a chapter unlock grants all its lessons. */
export function canAccessChapter(access: AccessSet, chapter: { id: string; levelId: string }) {
  return access.levels.has(chapter.levelId) || access.chapters.has(chapter.id);
}

export function canAccessLesson(
  access: AccessSet,
  lesson: { id: string; chapterId: string; levelId: string },
) {
  return (
    access.lessons.has(lesson.id) ||
    canAccessChapter(access, { id: lesson.chapterId, levelId: lesson.levelId })
  );
}

/**
 * A level is visible to a student if they can access anything in it.
 * `chapterLevel`/`lessonLevel` map ids to their level so partial unlocks surface the level.
 */
export function visibleLevelIds(
  access: AccessSet,
  chapterLevel: Map<string, string>,
  lessonLevel: Map<string, string>,
): Set<string> {
  const ids = new Set(access.levels);
  for (const c of access.chapters) {
    const l = chapterLevel.get(c);
    if (l) ids.add(l);
  }
  for (const les of access.lessons) {
    const l = lessonLevel.get(les);
    if (l) ids.add(l);
  }
  return ids;
}
