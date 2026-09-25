import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Test results" };

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ page?: string; failed?: string }> }) {
  const user = await requirePagePermission("VIEW_TEST_RESULTS");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = { completedAt: { not: null }, ...(sp.failed ? { passed: false } : {}) };
  const take = 50;
  const [rows, total, perTest] = await Promise.all([
    prisma.testAttempt.findMany({ where, orderBy: { completedAt: "desc" }, skip: (page - 1) * take, take, include: { user: { select: { id: true, name: true } }, test: { select: { title: true } } } }),
    prisma.testAttempt.count({ where }),
    prisma.testAttempt.groupBy({ by: ["testId"], where: { completedAt: { not: null } }, _avg: { percentage: true }, _count: { _all: true } }),
  ]);
  const tests = await prisma.test.findMany({ where: { id: { in: perTest.map((p) => p.testId) } }, select: { id: true, title: true } });
  const title = new Map(tests.map((t) => [t.id, t.title]));
  const linkStudents = hasPermission(user, "VIEW_STUDENTS");
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Test results</h1>
      <section className="card overflow-x-auto p-4">
        <h2 className="mb-2 font-semibold">By test</h2>
        <table className="table">
          <thead><tr><th>Test</th><th>Attempts</th><th>Average</th></tr></thead>
          <tbody>
            {perTest.map((p) => (
              <tr key={p.testId}><td>{title.get(p.testId)}</td><td>{p._count._all}</td><td>{Math.round(p._avg.percentage ?? 0)}%</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card overflow-x-auto p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Recent attempts</h2>
          <Link href={sp.failed ? "?" : "?failed=1"} className="text-sm text-brand-700">{sp.failed ? "Show all" : "Only failed"}</Link>
        </div>
        <table className="table">
          <thead><tr><th>Student</th><th>Test</th><th>#</th><th>Score</th><th>Result</th><th>Date</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{linkStudents ? <Link className="text-brand-700" href={`/admin/students/${a.user.id}`}>{a.user.name}</Link> : a.user.name}</td>
                <td><Link className="text-brand-700" href={`/admin/results/${a.id}`}>{a.test.title}</Link></td>
                <td>{a.attemptNumber}</td>
                <td>{a.correctCount}/{a.total} ({a.percentage}%)</td>
                <td>{a.passed ? <span className="text-emerald-600">Passed</span> : <span className="text-rose-600">Failed</span>}</td>
                <td className="text-slate-500">{a.completedAt?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex gap-2">
          {page > 1 && <Link className="btn-secondary" href={`?page=${page - 1}${sp.failed ? "&failed=1" : ""}`}>← Newer</Link>}
          {page * take < total && <Link className="btn-secondary" href={`?page=${page + 1}${sp.failed ? "&failed=1" : ""}`}>Older →</Link>}
        </div>
      </section>
    </div>
  );
}
