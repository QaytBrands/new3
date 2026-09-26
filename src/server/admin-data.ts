import "server-only";
import { prisma } from "@/lib/db";
import { buildAccessSet, canAccessLesson } from "@/lib/access";

import { lastZonedDayKeys, startOfZonedDay, zonedDayKey, zonedDayRange } from "@/lib/time";

const DAY = 86_400_000;

/**
 * Dashboard metrics. "Today" and the 7-day activity chart use the viewing admin's time zone
 * (each staff member sees their own local day); rolling windows (7/14/30 days) are time-zone independent.
 */
export async function getAdminStats(timeZone: string, nowDate = new Date()) {
  const now = nowDate.getTime();
  const weekAgo = new Date(now - 7 * DAY);
  const twoWeeksAgo = new Date(now - 14 * DAY);
  const { start: today, end: tomorrow } = zonedDayRange(nowDate, timeZone);
  const chartStart = startOfZonedDay(nowDate, timeZone, -6);

  const [students, lessonsToday, testsTotal, testsToday, avgScore, pronunciation, lessons, unlocks, seenCounts, recentAttempts, masteryAgg] =
    await Promise.all([
      prisma.user.findMany({ where: { role: "STUDENT" }, select: { id: true, name: true, username: true, active: true, lastActiveAt: true, createdAt: true } }),
      prisma.lessonProgress.count({ where: { completedAt: { gte: today, lt: tomorrow } } }),
      prisma.testAttempt.count({ where: { completedAt: { not: null } } }),
      prisma.testAttempt.count({ where: { completedAt: { gte: today, lt: tomorrow } } }),
      prisma.testAttempt.aggregate({ where: { completedAt: { gte: new Date(now - 30 * DAY) } }, _avg: { percentage: true } }),
      prisma.pronunciationAttempt.findMany({ where: { createdAt: { gte: chartStart, lt: tomorrow } }, select: { createdAt: true, userId: true } }),
      prisma.lesson.findMany({ select: { id: true, chapterId: true, chapter: { select: { levelId: true } }, _count: { select: { vocabulary: true } } } }),
      prisma.unlock.findMany({ select: { userId: true, scope: true, levelId: true, chapterId: true, lessonId: true } }),
      prisma.vocabularyProgress.groupBy({ by: ["userId"], where: { timesSeen: { gt: 0 } }, _count: { _all: true } }),
      prisma.testAttempt.findMany({ where: { completedAt: { gte: twoWeeksAgo } }, select: { userId: true, passed: true } }),
      prisma.vocabularyProgress.groupBy({ by: ["userId"], where: { timesCorrect: { gt: 0 } }, _avg: { mastery: true }, _count: { _all: true } }),
    ]);

  const active = students.filter((s) => s.active);
  const activeStudents = active.filter((s) => s.lastActiveAt && s.lastActiveAt >= weekAgo).length;

  // Vocabulary completion: words seen / words unlocked, summed over active students.
  const unlocksByUser = new Map<string, typeof unlocks>();
  for (const u of unlocks) unlocksByUser.set(u.userId, [...(unlocksByUser.get(u.userId) ?? []), u]);
  const seenByUser = new Map(seenCounts.map((s) => [s.userId, s._count._all]));
  let assigned = 0;
  let seen = 0;
  for (const s of active) {
    const access = buildAccessSet(unlocksByUser.get(s.id) ?? []);
    assigned += lessons
      .filter((l) => canAccessLesson(access, { id: l.id, chapterId: l.chapterId, levelId: l.chapter.levelId }))
      .reduce((a, l) => a + l._count.vocabulary, 0);
    seen += seenByUser.get(s.id) ?? 0;
  }

  // Students requiring attention
  const failures = new Map<string, number>();
  for (const a of recentAttempts) if (a.passed === false) failures.set(a.userId, (failures.get(a.userId) ?? 0) + 1);
  const mastery = new Map(masteryAgg.map((m) => [m.userId, m]));
  const attention = active
    .map((s) => {
      const reasons: string[] = [];
      const f = failures.get(s.id) ?? 0;
      if (f >= 2) reasons.push(`${f} failed tests in 14 days`);
      const lastSeen = s.lastActiveAt ?? s.createdAt;
      if (lastSeen < weekAgo) reasons.push(s.lastActiveAt ? `inactive for ${Math.floor((now - lastSeen.getTime()) / DAY)} days` : "never signed in");
      const m = mastery.get(s.id);
      if (m && m._count._all >= 10 && (m._avg.mastery ?? 0) < 0.4) reasons.push(`low mastery (${Math.round((m._avg.mastery ?? 0) * 100)}%)`);
      return { ...s, reasons };
    })
    .filter((s) => s.reasons.length > 0)
    .slice(0, 15);

  const byDay = new Map<string, number>(lastZonedDayKeys(nowDate, timeZone, 7).map((k) => [k, 0]));
  for (const p of pronunciation) {
    const k = zonedDayKey(p.createdAt, timeZone);
    if (byDay.has(k)) byDay.set(k, byDay.get(k)! + 1);
  }

  return {
    totalStudents: students.length,
    activeStudents,
    lessonsCompletedToday: lessonsToday,
    testsCompleted: testsTotal,
    testsCompletedToday: testsToday,
    averageScore: avgScore._avg.percentage,
    vocabularyCompletion: assigned ? seen / assigned : 0,
    wordsSeen: seen,
    wordsAssigned: assigned,
    attention,
    pronunciation: {
      total: pronunciation.length,
      students: new Set(pronunciation.map((p) => p.userId)).size,
      byDay: [...byDay.entries()],
    },
  };
}
