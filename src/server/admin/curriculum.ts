"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/guards";
import { sentenceSchema, vocabularySchema } from "@/lib/validation";
import { audit, bool, run, str, UserFacingError, type FormState } from "./common";

const title = z.string().trim().min(1, "Title is required").max(200);
const order = z.coerce.number().int().min(0).max(10000);

function vocabFromForm(fd: FormData) {
  return vocabularySchema.parse({
    german: str(fd, "german"),
    english: str(fd, "english"),
    article: str(fd, "article"),
    plural: str(fd, "plural"),
    partOfSpeech: str(fd, "partOfSpeech"),
    ipa: str(fd, "ipa"),
    phonetic: str(fd, "phonetic"),
    audioUrl: str(fd, "audioUrl"),
    difficulty: str(fd, "difficulty") || "1",
    tags: str(fd, "tags"),
  });
}

// ---- Levels ----------------------------------------------------------------

export async function saveLevel(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertPermission("MANAGE_LEVELS");
    const id = str(fd, "id");
    const data = {
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9.+-]{1,10}$/, "Code like A1, B2").parse(str(fd, "code")),
      name: title.parse(str(fd, "name")),
      description: str(fd, "description").trim() || null,
      order: order.parse(str(fd, "order") || "0"),
      wordsPerLesson: z.coerce.number().int().min(1).max(100).parse(str(fd, "wordsPerLesson") || "15"),
      published: bool(fd, "published"),
    };
    const level = id ? await prisma.level.update({ where: { id }, data }) : await prisma.level.create({ data });
    await audit(actor.id, id ? "level.update" : "level.create", level.id);
    revalidatePath("/admin/curriculum");
    return `Level ${level.code} saved.`;
  });
}

export async function deleteLevel(_: FormState, fd: FormData): Promise<FormState> {
  const res = await run(async () => {
    const actor = await assertPermission("MANAGE_LEVELS");
    const id = str(fd, "id");
    await prisma.level.delete({ where: { id } });
    await audit(actor.id, "level.delete", id);
  });
  if (res.ok) redirect("/admin/curriculum");
  return res;
}

// ---- Chapters & lessons (MANAGE_CHAPTERS) ------------------------------------

export async function saveChapter(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertPermission("MANAGE_CHAPTERS");
    const id = str(fd, "id");
    const data = {
      title: title.parse(str(fd, "title")),
      description: str(fd, "description").trim() || null,
      order: order.parse(str(fd, "order") || "0"),
    };
    const chapter = id
      ? await prisma.chapter.update({ where: { id }, data })
      : await prisma.chapter.create({ data: { ...data, levelId: z.string().min(1).parse(str(fd, "levelId")) } });
    await audit(actor.id, id ? "chapter.update" : "chapter.create", chapter.id);
    revalidatePath(`/admin/curriculum`);
    return "Chapter saved.";
  });
}

export async function deleteChapter(_: FormState, fd: FormData): Promise<FormState> {
  let levelId = "";
  const res = await run(async () => {
    const actor = await assertPermission("MANAGE_CHAPTERS");
    const c = await prisma.chapter.delete({ where: { id: str(fd, "id") } });
    levelId = c.levelId;
    await audit(actor.id, "chapter.delete", c.id);
  });
  if (res.ok) redirect(`/admin/curriculum/levels/${levelId}`);
  return res;
}

export async function saveLesson(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertPermission("MANAGE_CHAPTERS");
    const id = str(fd, "id");
    const dayNumber = z.coerce.number().int().min(1).max(366).parse(str(fd, "dayNumber"));
    const data = { title: title.parse(str(fd, "title")), dayNumber, order: dayNumber };
    const lesson = id
      ? await prisma.lesson.update({ where: { id }, data })
      : await prisma.lesson.create({ data: { ...data, chapterId: z.string().min(1).parse(str(fd, "chapterId")) } });
    await audit(actor.id, id ? "lesson.update" : "lesson.create", lesson.id);
    revalidatePath(`/admin/curriculum`);
    return "Lesson saved.";
  });
}

export async function deleteLesson(_: FormState, fd: FormData): Promise<FormState> {
  let chapterId = "";
  const res = await run(async () => {
    const actor = await assertPermission("MANAGE_CHAPTERS");
    const l = await prisma.lesson.delete({ where: { id: str(fd, "id") } });
    chapterId = l.chapterId;
    await audit(actor.id, "lesson.delete", l.id);
  });
  if (res.ok) redirect(`/admin/curriculum/chapters/${chapterId}`);
  return res;
}

// ---- Vocabulary (MANAGE_VOCABULARY) ------------------------------------------

export async function assertLessonCapacity(lessonId: string, adding: number) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { _count: { select: { vocabulary: true } }, chapter: { select: { level: { select: { wordsPerLesson: true } } } } },
  });
  if (!lesson) throw new UserFacingError("Lesson not found.");
  const limit = lesson.chapter.level.wordsPerLesson;
  if (lesson._count.vocabulary + adding > limit) {
    throw new UserFacingError(`This level allows ${limit} words per lesson; the lesson already has ${lesson._count.vocabulary}.`);
  }
  return lesson._count.vocabulary;
}

export async function createVocabulary(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertPermission("MANAGE_VOCABULARY");
    const lessonId = z.string().min(1).parse(str(fd, "lessonId"));
    const data = vocabFromForm(fd);
    const count = await assertLessonCapacity(lessonId, 1);
    const exDe = str(fd, "exampleGerman").trim();
    const exEn = str(fd, "exampleEnglish").trim();
    const v = await prisma.vocabulary.create({
      data: {
        ...data,
        lessonId,
        order: count + 1,
        sentences: exDe ? { create: [sentenceSchema.parse({ german: exDe, english: exEn || "—" })] } : undefined,
      },
    });
    await audit(actor.id, "vocabulary.create", v.id);
    revalidatePath(`/admin/curriculum/lessons/${lessonId}`);
    return `Added “${v.german}”.`;
  });
}

export async function updateVocabulary(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertPermission("MANAGE_VOCABULARY");
    const id = str(fd, "id");
    const data = vocabFromForm(fd);
    const newLessonId = str(fd, "lessonId");
    const current = await prisma.vocabulary.findUniqueOrThrow({ where: { id } });
    if (newLessonId && newLessonId !== current.lessonId) await assertLessonCapacity(newLessonId, 1);
    await prisma.vocabulary.update({
      where: { id },
      data: { ...data, order: order.parse(str(fd, "order") || String(current.order)), ...(newLessonId ? { lessonId: newLessonId } : {}) },
    });
    await audit(actor.id, "vocabulary.update", id);
    revalidatePath(`/admin/vocabulary/${id}`);
  });
}

export async function deleteVocabulary(_: FormState, fd: FormData): Promise<FormState> {
  let lessonId = "";
  const res = await run(async () => {
    const actor = await assertPermission("MANAGE_VOCABULARY");
    const v = await prisma.vocabulary.delete({ where: { id: str(fd, "id") } });
    lessonId = v.lessonId;
    await audit(actor.id, "vocabulary.delete", v.id, { german: v.german });
  });
  if (res.ok) redirect(`/admin/curriculum/lessons/${lessonId}`);
  return res;
}

// ---- Sentences (MANAGE_SENTENCES) --------------------------------------------

export async function saveSentence(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertPermission("MANAGE_SENTENCES");
    const id = str(fd, "id");
    const data = sentenceSchema.parse({ german: str(fd, "german"), english: str(fd, "english"), audioUrl: str(fd, "audioUrl") });
    let vocabularyId = str(fd, "vocabularyId");
    if (id) {
      vocabularyId = (await prisma.exampleSentence.update({ where: { id }, data })).vocabularyId;
    } else {
      if (!(await prisma.vocabulary.count({ where: { id: vocabularyId } }))) throw new UserFacingError("Word not found.");
      await prisma.exampleSentence.create({ data: { ...data, vocabularyId } });
    }
    await audit(actor.id, id ? "sentence.update" : "sentence.create", vocabularyId);
    revalidatePath(`/admin/vocabulary/${vocabularyId}`);
    return "Sentence saved.";
  });
}

export async function deleteSentence(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertPermission("MANAGE_SENTENCES");
    const s = await prisma.exampleSentence.delete({ where: { id: str(fd, "id") } });
    await audit(actor.id, "sentence.delete", s.vocabularyId);
    revalidatePath(`/admin/vocabulary/${s.vocabularyId}`);
    return "Sentence deleted.";
  });
}
