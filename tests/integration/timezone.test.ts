import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cleanup, makeUser, tag } from "./setup";
import { getRevisionWords, getStudentToday } from "@/server/student-data";
import { getAdminStats } from "@/server/admin-data";
import { finalizeAttempt, startAttempt } from "@/server/test-service";
import { zonedDayKey } from "@/lib/time";

const CODE = tag.toUpperCase();
// Far-future dates so rows from other tests/seed data never fall in these windows.
const NOW = new Date("2031-03-02T05:00:00Z"); // 10:30 IST on 2 March; 05:00 UTC on 2 March
const LATE_EVENING_UTC = new Date("2031-03-01T19:00:00Z"); // 1 March in UTC, but 00:30 on 2 March in IST

let kolkata: User, utc: User;
let lessonId: string, vocabId: string, testId: string;

beforeAll(async () => {
  const level = await prisma.level.create({ data: { code: `${CODE}-TZ`, name: "TZ", order: 950 } });
  const chapter = await prisma.chapter.create({ data: { levelId: level.id, title: "TZ" } });
  const lesson = await prisma.lesson.create({ data: { chapterId: chapter.id, dayNumber: 1, title: "TZ" } });
  const vocab = await prisma.vocabulary.create({ data: { lessonId: lesson.id, german: "Uhr", english: "clock" } });
  const test = await prisma.test.create({ data: { kind: "DAILY", title: "TZ", lessonId: lesson.id, questionCount: 1, questionTypes: ["DE_TO_EN"], passingScore: 50 } });
  lessonId = lesson.id;
  vocabId = vocab.id;
  testId = test.id;
  kolkata = await makeUser("kolkata", "STUDENT"); // default zone
  utc = await makeUser("utc", "STUDENT", { timezone: "UTC" });
  for (const u of [kolkata, utc]) {
    await prisma.unlock.create({ data: { userId: u.id, scope: "LESSON", lessonId } });
    await prisma.lessonProgress.create({ data: { userId: u.id, lessonId, status: "COMPLETED", completedAt: LATE_EVENING_UTC } });
  }
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("time-zone-sensitive daily calculations", () => {
  it("existing/sample students default to Asia/Kolkata", () => {
    expect(kolkata.timezone).toBe("Asia/Kolkata");
  });

  it("counts a lesson completed at 19:00 UTC as 'today' in Kolkata but 'yesterday' in UTC", async () => {
    expect((await getStudentToday(kolkata.id, "Asia/Kolkata", NOW)).lessonsCompleted).toBe(1);
    expect((await getStudentToday(utc.id, "UTC", NOW)).lessonsCompleted).toBe(0);
  });

  it("admin 'lessons completed today' follows the viewing admin's time zone", async () => {
    expect((await getAdminStats("Asia/Kolkata", NOW)).lessonsCompletedToday).toBe(2);
    expect((await getAdminStats("UTC", NOW)).lessonsCompletedToday).toBe(0);
    const chart = (await getAdminStats("Asia/Kolkata", NOW)).pronunciation.byDay.map(([d]) => d);
    expect(chart.at(-1)).toBe("2031-03-02");
    expect(chart).toHaveLength(7);
  });

  it("review due dates land on local midnight, and 'due today' uses the student's day", async () => {
    await prisma.vocabularyProgress.create({
      data: { userId: kolkata.id, vocabularyId: vocabId, nextReviewAt: new Date("2031-03-02T18:00:00Z") }, // 23:30 IST on 2 March
    });
    expect((await getRevisionWords(kolkata.id, "Asia/Kolkata", NOW)).map((r) => r.vocabularyId)).toContain(vocabId);
    expect((await getRevisionWords(kolkata.id, "Asia/Kolkata", new Date("2031-03-01T12:00:00Z"))).map((r) => r.vocabularyId)).not.toContain(vocabId);
  });

  it("a correct daily-test answer schedules the next review for the student's local midnight", async () => {
    const attemptId = await startAttempt(kolkata.id, testId);
    const q = await prisma.testAnswer.findFirstOrThrow({ where: { attemptId } });
    const done = await finalizeAttempt(kolkata.id, attemptId, { [q.position]: q.correctAnswer });
    expect(done.passed).toBe(true);
    const p = await prisma.vocabularyProgress.findUniqueOrThrow({ where: { userId_vocabularyId: { userId: kolkata.id, vocabularyId: vocabId } } });
    const ist = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(p.nextReviewAt!);
    expect(ist).toBe("00:00");
    expect(zonedDayKey(p.nextReviewAt!, "Asia/Kolkata") > zonedDayKey(new Date(), "Asia/Kolkata")).toBe(true);
  });
});
