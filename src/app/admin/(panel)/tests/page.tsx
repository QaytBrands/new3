import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";

export const metadata = { title: "Tests" };

export default async function TestsAdmin() {
  await requirePagePermission("MANAGE_TESTS");
  const tests = await prisma.test.findMany({
    orderBy: [{ createdAt: "asc" }],
    include: {
      lesson: { select: { dayNumber: true, chapter: { select: { title: true, order: true, level: { select: { code: true, order: true } } } } } },
      chapter: { select: { title: true, order: true, level: { select: { code: true, order: true } } } },
      _count: { select: { attempts: { where: { completedAt: { not: null } } } } },
    },
  });
  const key = (t: (typeof tests)[number]) => {
    const ch = t.lesson?.chapter ?? t.chapter!;
    return [ch.level.order, ch.order, t.kind === "WEEKLY" ? 999 : t.lesson!.dayNumber];
  };
  tests.sort((a, b) => {
    const ka = key(a), kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Tests</h1>
      <p className="text-sm text-slate-500">Create daily tests from a day’s page and weekly tests from a chapter’s page in Curriculum.</p>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Test</th><th>Type</th><th>Scope</th><th>Questions</th><th>Pass</th><th>Time</th><th>Attempts</th></tr></thead>
          <tbody>
            {tests.map((t) => {
              const ch = t.lesson?.chapter ?? t.chapter!;
              return (
                <tr key={t.id}>
                  <td><Link className="text-brand-700" href={`/admin/tests/${t.id}`}>{t.title}</Link>{!t.published && <span className="ml-1 text-xs text-slate-400">(hidden)</span>}</td>
                  <td>{t.kind === "DAILY" ? "Daily" : "Weekly"}</td>
                  <td>{ch.level.code} · {ch.title}{t.lesson && ` · Day ${t.lesson.dayNumber}`}</td>
                  <td>{t.questionCount}</td>
                  <td>{t.passingScore}%</td>
                  <td>{t.timeLimitSec ? `${Math.round(t.timeLimitSec / 60)}m` : "—"}</td>
                  <td>{t._count.attempts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
