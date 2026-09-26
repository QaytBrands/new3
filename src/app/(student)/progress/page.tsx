import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth/guards";
import { getMasterySummary, getStudentCurriculum } from "@/server/student-data";
import { ProgressBar } from "@/components/ui/ProgressBar";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireStudent();
  const levels = await getStudentCurriculum(user.id);
  const [mastery, attempts, pronunciationCount] = await Promise.all([
    getMasterySummary(user.id, levels),
    prisma.testAttempt.findMany({
      where: { userId: user.id, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 15,
      include: { test: { select: { title: true, kind: true } } },
    }),
    prisma.pronunciationAttempt.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your progress</h1>
        <p className="text-xs text-slate-400">Days and review dates follow your time zone: {user.timezone}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4"><p className="label">Mastery</p><p className="text-2xl font-bold">{Math.round(mastery.averageMastery * 100)}%</p><ProgressBar className="mt-2" value={mastery.averageMastery * 100} tone="green" /></div>
        <div className="card p-4"><p className="label">Words</p><p className="text-2xl font-bold">{mastery.masteredWords}<span className="text-base font-normal text-slate-500"> mastered / {mastery.totalWords}</span></p></div>
        <div className="card p-4"><p className="label">Pronunciation</p><p className="text-2xl font-bold">{pronunciationCount}<span className="text-base font-normal text-slate-500"> recordings</span></p></div>
      </div>

      {levels.map((level) => {
        const all = level.chapters.flatMap((c) => c.lessons);
        const done = all.filter((l) => l.status === "COMPLETED").length;
        return (
          <section key={level.id} className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{level.code} · {level.name}</h2>
              <span className="text-sm text-slate-500">{done}/{all.length} days</span>
            </div>
            <ProgressBar className="mt-2" value={(done / Math.max(1, all.length)) * 100} />
            <ul className="mt-4 space-y-3">
              {level.chapters.map((c) => {
                const cd = c.lessons.filter((l) => l.status === "COMPLETED").length;
                return (
                  <li key={c.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={c.accessible ? "" : "text-slate-400"}>{c.accessible ? "" : "🔒 "}{c.title}</span>
                      <span className="text-slate-500">
                        {cd}/{c.lessons.length}
                        {c.weeklyTest && (c.weeklyTest.passed ? " · weekly ✓" : c.weeklyTest.attempts ? ` · weekly ${c.weeklyTest.bestPercentage}%` : "")}
                      </span>
                    </div>
                    <ProgressBar className="mt-1 h-1.5" value={(cd / Math.max(1, c.lessons.length)) * 100} tone={cd === c.lessons.length && cd > 0 ? "green" : "brand"} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="card p-5">
        <h2 className="mb-2 text-lg font-semibold">Test history</h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-500">No tests taken yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {attempts.map((a) => (
              <li key={a.id}>
                <Link href={`/attempts/${a.id}`} className="flex items-center justify-between py-2 text-sm">
                  <span>{a.test.title} <span className="text-slate-400">#{a.attemptNumber}</span></span>
                  <span className={a.passed ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>{a.percentage}%</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
