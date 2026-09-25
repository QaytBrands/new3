import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth/guards";
import { getTestForStudent } from "@/server/test-service";
import { StartTestButton } from "@/components/student/StartTestButton";
import { QUESTION_TYPE_LABELS } from "@/lib/tests/types";

export default async function TestIntroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent();
  const test = await getTestForStudent(user.id, id);
  if (!test) notFound();
  const attempts = await prisma.testAttempt.findMany({ where: { userId: user.id, testId: id }, orderBy: { attemptNumber: "desc" } });
  const open = attempts.find((a) => !a.completedAt);
  const done = attempts.filter((a) => a.completedAt);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{test.kind === "DAILY" ? "Daily test" : "Weekly test"}</p>
        <h1 className="mt-1 text-2xl font-bold">{test.title}</h1>
        <ul className="mt-4 grid grid-cols-3 gap-3 text-center">
          <li className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-bold">{test.questionCount}</p><p className="text-xs text-slate-500">questions</p></li>
          <li className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-bold">{test.passingScore}%</p><p className="text-xs text-slate-500">to pass</p></li>
          <li className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-bold">{test.timeLimitSec ? `${Math.round(test.timeLimitSec / 60)}m` : "∞"}</p><p className="text-xs text-slate-500">time limit</p></li>
        </ul>
        <p className="mt-4 text-sm text-slate-500">Includes: {test.questionTypes.map((t) => QUESTION_TYPE_LABELS[t]).join(", ")}</p>
        <div className="mt-6">
          <StartTestButton testId={id} label={open ? "Resume test" : done.length ? "Try again" : "Start test"} />
        </div>
      </div>
      {done.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-2 font-semibold">Your attempts</h2>
          <ul className="divide-y divide-slate-100">
            {done.map((a) => (
              <li key={a.id}>
                <Link href={`/attempts/${a.id}`} className="flex items-center justify-between py-2 text-sm">
                  <span>Attempt {a.attemptNumber} · {a.completedAt!.toLocaleDateString()}</span>
                  <span className={a.passed ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>{a.percentage}% {a.passed ? "passed" : "not passed"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
