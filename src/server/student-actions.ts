"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertStudent, ForbiddenError } from "@/lib/auth/guards";
import { assertVocabularyAccess, getAccessibleLesson } from "./student-data";

/** Called as the student moves through a lesson's cards. */
export async function markWordSeen(lessonId: string, vocabularyId: string) {
  const user = await assertStudent();
  const lesson = await getAccessibleLesson(user.id, lessonId);
  if (!lesson || !lesson.vocabulary.some((v) => v.id === vocabularyId)) throw new ForbiddenError();

  await prisma.$transaction(async (tx) => {
    const lp = await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      create: { userId: user.id, lessonId, status: "IN_PROGRESS", seenVocabularyIds: [vocabularyId] },
      update: {},
    });
    if (!lp.seenVocabularyIds.includes(vocabularyId)) {
      await tx.lessonProgress.update({
        where: { id: lp.id },
        data: {
          seenVocabularyIds: { push: vocabularyId },
          status: lp.status === "NOT_STARTED" ? "IN_PROGRESS" : lp.status,
        },
      });
    }
    await tx.vocabularyProgress.upsert({
      where: { userId_vocabularyId: { userId: user.id, vocabularyId } },
      create: { userId: user.id, vocabularyId, timesSeen: 1, nextReviewAt: new Date() },
      update: { timesSeen: { increment: 1 } },
    });
  });
}

export async function setDifficult(vocabularyId: string, difficult: boolean) {
  const user = await assertStudent();
  if (!(await assertVocabularyAccess(user.id, vocabularyId))) throw new ForbiddenError();
  await prisma.vocabularyProgress.upsert({
    where: { userId_vocabularyId: { userId: user.id, vocabularyId } },
    create: { userId: user.id, vocabularyId, difficult },
    update: { difficult },
  });
  revalidatePath("/words");
  revalidatePath("/dashboard");
}

export async function completeLesson(lessonId: string) {
  const user = await assertStudent();
  const lesson = await getAccessibleLesson(user.id, lessonId);
  if (!lesson) throw new ForbiddenError();
  const lp = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } } });
  const seen = new Set(lp?.seenVocabularyIds ?? []);
  if (!lesson.vocabulary.every((v) => seen.has(v.id))) {
    return { ok: false as const, error: "Go through every word before completing the lesson." };
  }
  await prisma.lessonProgress.update({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    data: { status: "COMPLETED", completedAt: lp?.completedAt ?? new Date() },
  });
  revalidatePath("/dashboard");
  return { ok: true as const, dailyTestId: lesson.tests[0]?.id ?? null };
}
