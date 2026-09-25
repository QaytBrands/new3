"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { QuestionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAdmin, assertPermission } from "@/lib/auth/guards";
import { audit, bool, run, str, UserFacingError, type FormState } from "./common";

const QUESTION_TYPES: QuestionType[] = ["DE_TO_EN", "EN_TO_DE", "ARTICLE", "SPELLING", "SENTENCE", "LISTENING", "PRONUNCIATION"];

export async function saveTest(_: FormState, fd: FormData): Promise<FormState> {
  let savedId = "";
  const res = await run(async () => {
    const actor = await assertPermission("MANAGE_TESTS");
    const id = str(fd, "id");
    const types = fd.getAll("questionTypes").filter((t): t is QuestionType => QUESTION_TYPES.includes(t as QuestionType));
    if (types.length === 0) throw new UserFacingError("Choose at least one question type.");
    const minutes = str(fd, "timeLimitMin").trim();
    const data = {
      title: z.string().trim().min(1).max(200).parse(str(fd, "title")),
      questionCount: z.coerce.number().int().min(1).max(100).parse(str(fd, "questionCount")),
      passingScore: z.coerce.number().int().min(0).max(100).parse(str(fd, "passingScore")),
      timeLimitSec: minutes ? z.coerce.number().int().min(1).max(600).parse(minutes) * 60 : null,
      questionTypes: types,
      randomize: bool(fd, "randomize"),
      published: bool(fd, "published"),
    };
    if (id) {
      await prisma.test.update({ where: { id }, data });
      savedId = id;
    } else {
      const kind = z.enum(["DAILY", "WEEKLY"]).parse(str(fd, "kind"));
      const lessonId = kind === "DAILY" ? z.string().min(1).parse(str(fd, "lessonId")) : null;
      const chapterId = kind === "WEEKLY" ? z.string().min(1).parse(str(fd, "chapterId")) : null;
      savedId = (await prisma.test.create({ data: { ...data, kind, lessonId, chapterId } })).id;
    }
    await audit(actor.id, id ? "test.update" : "test.create", savedId);
    revalidatePath("/admin/tests");
  });
  if (res.ok && !str(fd, "id")) redirect(`/admin/tests/${savedId}`);
  return res;
}

export async function deleteTest(_: FormState, fd: FormData): Promise<FormState> {
  const res = await run(async () => {
    const actor = await assertPermission("MANAGE_TESTS");
    const t = await prisma.test.delete({ where: { id: str(fd, "id") } });
    await audit(actor.id, "test.delete", t.id);
  });
  if (res.ok) redirect("/admin/tests");
  return res;
}

export async function saveSettings(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const actor = await assertAdmin();
    const n = (k: string, max: number) => z.coerce.number().int().min(1).max(max).parse(str(fd, k));
    const data = {
      autoUnlockNextLesson: bool(fd, "autoUnlockNextLesson"),
      autoUnlockNextChapter: bool(fd, "autoUnlockNextChapter"),
      defaultWordsPerLesson: n("defaultWordsPerLesson", 100),
      defaultDailyPassScore: n("defaultDailyPassScore", 100),
      defaultWeeklyPassScore: n("defaultWeeklyPassScore", 100),
    };
    await prisma.appSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    await audit(actor.id, "settings.update", undefined, data);
    revalidatePath("/admin/settings");
  });
}
