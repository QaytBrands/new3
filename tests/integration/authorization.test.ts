import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The Neon Auth session is represented by the identity it yields; the app maps it to a user itself.
vi.mock("@/lib/auth/neon-server", async () => {
  const { session } = await import("./setup");
  return { getIdentity: vi.fn(async () => session.current), neonAuth: vi.fn(), clearNeonAuthCookies: vi.fn() };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cleanup, fd, makeUser, signInAs, tag } from "./setup";
import { assertVocabularyAccess, getAccessibleLesson, getRevisionWords, getStudentCurriculum } from "@/server/student-data";
import { finalizeAttempt, getAttemptForRunner, getTestForStudent, startAttempt } from "@/server/test-service";
import { completeLesson, markWordSeen, setDifficult } from "@/server/student-actions";
import { startTest, submitTest } from "@/server/test-actions";
import { recordPronunciationAttempt, RecordingError } from "@/server/pronunciation-service";
import { GET as getRecordingAudio } from "@/app/api/recordings/[id]/audio/route";
import * as users from "@/server/admin/users";
import { getCurrentUser } from "@/lib/auth/guards";
import * as curriculum from "@/server/admin/curriculum";
import * as adminTests from "@/server/admin/tests";
import { importVocabulary } from "@/server/admin/import";

const CODE = tag.toUpperCase();

let admin: User, studentA: User, studentB: User, viewer: User, unlocker: User, editor: User, inactive: User, progressViewer: User;
const ids: Record<string, string> = {};

beforeAll(async () => {
  const level = await prisma.level.create({ data: { code: `${CODE}-P`, name: "Published", order: 900 } });
  const hidden = await prisma.level.create({ data: { code: `${CODE}-H`, name: "Hidden", order: 901, published: false } });
  const mk = async (levelId: string, title: string, word: string) => {
    const chapter = await prisma.chapter.create({ data: { levelId, title, order: 1 } });
    const lesson = await prisma.lesson.create({ data: { chapterId: chapter.id, dayNumber: 1, title } });
    const vocab = await prisma.vocabulary.create({
      data: { lessonId: lesson.id, german: word, english: `${word}-en`, sentences: { create: [{ german: `Das ist ${word}.`, english: "x" }] } },
    });
    const test = await prisma.test.create({ data: { kind: "DAILY", title, lessonId: lesson.id, questionCount: 3, questionTypes: ["DE_TO_EN", "SPELLING"] } });
    return { chapter: chapter.id, lesson: lesson.id, vocab: vocab.id, test: test.id };
  };
  const c1 = await mk(level.id, "One", "Eins");
  const c2 = await mk(level.id, "Two", "Zwei");
  const h = await mk(hidden.id, "Hidden", "Geheim");
  Object.assign(ids, { levelId: level.id, hiddenLevelId: hidden.id, c1: c1.chapter, l1: c1.lesson, v1: c1.vocab, t1: c1.test, c2: c2.chapter, l2: c2.lesson, v2: c2.vocab, t2: c2.test, hl: h.lesson, hv: h.vocab, ht: h.test });

  admin = await makeUser("admin", "ADMIN");
  studentA = await makeUser("studentA", "STUDENT");
  studentB = await makeUser("studentB", "STUDENT");
  viewer = await makeUser("viewer", "STAFF", { permissions: ["VIEW_STUDENTS"] });
  unlocker = await makeUser("unlocker", "STAFF", { permissions: ["UNLOCK_CHAPTERS"] });
  editor = await makeUser("editor", "STAFF", { permissions: ["EDIT_STUDENTS"] });
  progressViewer = await makeUser("progress", "STAFF", { permissions: ["VIEW_PROGRESS"] });
  inactive = await makeUser("inactive", "STAFF", { permissions: ["UNLOCK_CHAPTERS", "UNLOCK_LEVELS", "CREATE_STUDENTS"], active: false });

  await prisma.unlock.createMany({
    data: [
      { userId: studentA.id, scope: "CHAPTER", chapterId: c1.chapter },
      { userId: studentA.id, scope: "LEVEL", levelId: hidden.id }, // unlocked but unpublished
      { userId: studentB.id, scope: "CHAPTER", chapterId: c2.chapter },
    ],
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("identity → application user mapping", () => {
  it("maps a Neon Auth identity to its linked user, and nothing else", async () => {
    signInAs(studentA);
    expect((await getCurrentUser())?.id).toBe(studentA.id);
    signInAs({ neonAuthUserId: "na_not_linked_to_any_user", email: studentA.email }); // same email, unknown id
    expect(await getCurrentUser()).toBeNull();
    signInAs(null);
    expect(await getCurrentUser()).toBeNull();
  });

  it("a valid identity for a deactivated user gets nothing", async () => {
    signInAs(inactive);
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("student isolation", () => {
  it("cannot open lessons, tests or words outside their unlocks", async () => {
    expect(await getAccessibleLesson(studentA.id, ids.l1)).not.toBeNull();
    expect(await getAccessibleLesson(studentA.id, ids.l2)).toBeNull();
    expect(await getTestForStudent(studentA.id, ids.t2)).toBeNull();
    expect(await assertVocabularyAccess(studentA.id, ids.v2)).toBeNull();
  });

  it("cannot use content from an unpublished level even if unlocked", async () => {
    expect(await getAccessibleLesson(studentA.id, ids.hl)).toBeNull();
    expect(await getTestForStudent(studentA.id, ids.ht)).toBeNull();
    expect(await assertVocabularyAccess(studentA.id, ids.hv)).toBeNull();
    const levels = await getStudentCurriculum(studentA.id);
    expect(levels.map((l) => l.id)).not.toContain(ids.hiddenLevelId);
  });

  it("server actions reject locked content", async () => {
    signInAs(studentA);
    await expect(markWordSeen(ids.l2, ids.v2)).rejects.toThrow();
    await expect(setDifficult(ids.v2, true)).rejects.toThrow();
    await expect(completeLesson(ids.l2)).rejects.toThrow();
    expect(await startTest(ids.t2)).toEqual({ error: "Test not available." });
    // Malformed arguments from a hand-crafted request
    await expect(setDifficult(ids.v1, "yes" as unknown as boolean)).rejects.toThrow();
  });

  it("cannot read, submit or grade another student's test attempt", async () => {
    const attemptB = await startAttempt(studentB.id, ids.t2);
    expect(await getAttemptForRunner(studentA.id, attemptB)).toBeNull();
    await expect(finalizeAttempt(studentA.id, attemptB, {})).rejects.toThrow("Attempt not found");
    signInAs(studentA);
    await expect(submitTest(attemptB, { 0: "x" })).rejects.toThrow();
    const stillOpen = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attemptB } });
    expect(stillOpen.completedAt).toBeNull();
  });

  it("never sees another student's progress or vocabulary history", async () => {
    signInAs(studentB);
    await markWordSeen(ids.l2, ids.v2);
    await setDifficult(ids.v2, true);
    const aLevels = await getStudentCurriculum(studentA.id);
    const l2 = aLevels.flatMap((l) => l.chapters).flatMap((c) => c.lessons).find((l) => l.id === ids.l2);
    expect(l2?.accessible).toBe(false);
    expect(l2?.status).toBe("NOT_STARTED");
    expect(l2?.seenCount).toBe(0);
    const revision = await getRevisionWords(studentA.id, studentA.timezone);
    expect(revision.map((r) => r.vocabularyId)).not.toContain(ids.v2);
  });

  it("cannot record against locked words or listen to another student's recording", async () => {
    await expect(recordPronunciationAttempt({ userId: studentA.id, vocabularyId: ids.v2, audio: null, clientTranscript: "Zwei" })).rejects.toBeInstanceOf(RecordingError);

    const audio = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" });
    const rec = await recordPronunciationAttempt({ userId: studentB.id, vocabularyId: ids.v2, audio, clientTranscript: "Zwei" });
    expect(rec.result.overallScore).toBeNull();
    const call = () => getRecordingAudio(new Request("http://x"), { params: Promise.resolve({ id: rec.id }) });

    signInAs(studentA);
    expect((await call()).status).toBe(404);
    signInAs(viewer); // staff without VIEW_PROGRESS
    expect((await call()).status).toBe(404);
    signInAs(null);
    expect((await call()).status).toBe(401);
    signInAs(studentB);
    const own = await call();
    expect(own.status).toBe(200);
    expect(own.headers.get("cache-control")).toContain("private");
    signInAs(progressViewer);
    expect((await call()).status).toBe(200);
  });
});

describe("staff permission boundaries", () => {
  const denied = { error: "You do not have permission to do this." };

  it("a VIEW_STUDENTS-only staff member cannot mutate anything", async () => {
    signInAs(viewer);
    expect(await users.createStudent({}, fd({ name: "X", username: `${tag}_x`, password: "longenough1" }))).toEqual(denied);
    expect(await users.updateStudent({}, fd({ id: studentA.id, name: "Hacked", timezone: "UTC" }))).toEqual(denied);
    expect(await users.setUnlock({}, fd({ userId: studentA.id, scope: "CHAPTER", targetId: ids.c2 }))).toEqual(denied);
    expect(await users.resetStudentProgress({}, fd({ id: studentA.id, scope: "all" }))).toEqual(denied);
    expect(await users.deleteStudent({}, fd({ id: studentA.id }))).toEqual(denied);
    expect(await curriculum.saveLevel({}, fd({ code: "ZZ9", name: "x" }))).toEqual(denied);
    expect(await curriculum.createVocabulary({}, fd({ lessonId: ids.l1, german: "a", english: "b" }))).toEqual(denied);
    expect(await adminTests.saveTest({}, fd({ id: ids.t1, title: "x", questionCount: "1", passingScore: "1", questionTypes: "DE_TO_EN" }))).toEqual(denied);
    expect(await adminTests.saveSettings({}, fd({ defaultWordsPerLesson: "1" }))).toEqual(denied);
    await expect(importVocabulary({}, fd({}))).rejects.toThrow();
  });

  it("staff cannot escalate their own permissions or manage staff", async () => {
    signInAs(viewer);
    expect(await users.updateStaff({}, fd({ id: viewer.id, name: "v", permissions: ["CREATE_STUDENTS", "UNLOCK_LEVELS"] }))).toEqual(denied);
    expect(await users.createStaff({}, fd({ name: "s", username: `${tag}_s`, password: "longenough1" }))).toEqual(denied);
    expect(await users.updateOwnTimezone({}, fd({ timezone: "Europe/Berlin" }))).toMatchObject({ ok: true });
    const me = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } });
    expect(me.permissions).toEqual(["VIEW_STUDENTS"]);
    expect(me.timezone).toBe("Europe/Berlin");
  });

  it("UNLOCK_CHAPTERS allows chapter/lesson unlocks but not level unlocks", async () => {
    signInAs(unlocker);
    expect(await users.setUnlock({}, fd({ userId: studentA.id, scope: "LEVEL", targetId: ids.levelId }))).toEqual(denied);
    expect(await users.setUnlock({}, fd({ userId: studentA.id, scope: "LESSON", targetId: ids.l2 }))).toMatchObject({ ok: true });
    expect(await getAccessibleLesson(studentA.id, ids.l2)).not.toBeNull();
    expect(await users.setUnlock({}, fd({ userId: studentA.id, scope: "LESSON", targetId: ids.l2, mode: "lock" }))).toMatchObject({ ok: true });
    expect(await getAccessibleLesson(studentA.id, ids.l2)).toBeNull();
  });

  it("EDIT_STUDENTS cannot be used to edit staff or admin accounts", async () => {
    signInAs(editor);
    expect(await users.updateStudent({}, fd({ id: admin.id, name: "Owned", password: "newpassword1" }))).toEqual({ error: "Student not found." });
    expect(await users.updateStudent({}, fd({ id: studentA.id, name: "Student A", timezone: "Nowhere/Invalid" }))).toMatchObject({ error: expect.stringContaining("time zone") });
  });

  it("deactivated staff and students get nothing", async () => {
    signInAs(inactive);
    expect(await users.setUnlock({}, fd({ userId: studentA.id, scope: "LEVEL", targetId: ids.levelId }))).toEqual(denied);
    expect(await users.createStudent({}, fd({ name: "X", username: `${tag}_y`, password: "longenough1" }))).toEqual(denied);
    signInAs(studentA);
    expect(await users.createStudent({}, fd({ name: "X", username: `${tag}_z`, password: "longenough1" }))).toEqual(denied);
    expect(await users.updateOwnTimezone({}, fd({ timezone: "UTC" }))).toEqual(denied);
  });

  it("only admins can reset progress and delete students; new students default to Asia/Kolkata", async () => {
    signInAs(admin);
    expect(
      await users.createStudent({}, fd({ name: "New", username: `${tag}_new`, email: `${tag}_new@integration.test`, password: "longenough1" })),
    ).toMatchObject({ ok: true });
    const created = await prisma.user.findUniqueOrThrow({ where: { username: `${tag}_new` } });
    expect(created.timezone).toBe("Asia/Kolkata");
    expect(created.role).toBe("STUDENT");
    expect(created.neonAuthUserId).toBeTruthy(); // linked to a real (stand-in) Neon Auth identity
    expect(created.passwordHash).toBeNull(); // passwords live in Neon Auth only
    expect(await users.resetStudentProgress({}, fd({ id: studentB.id, scope: "lessons" }))).toMatchObject({ ok: true });
    expect(await prisma.vocabularyProgress.count({ where: { userId: studentB.id } })).toBe(0);
  });
});
