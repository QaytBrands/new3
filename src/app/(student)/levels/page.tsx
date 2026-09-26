import Link from "next/link";
import { requireStudent } from "@/lib/auth/guards";
import { getStudentCurriculum } from "@/server/student-data";
import { ProgressBar } from "@/components/ui/ProgressBar";

export const metadata = { title: "Learn" };

export default async function LevelsPage() {
  const user = await requireStudent();
  const levels = await getStudentCurriculum(user.id);
  if (levels.length === 0) return <p className="text-slate-500">No content has been unlocked for you yet.</p>;
  return (
    <div className="space-y-8">
      {levels.map((level) => (
        <section key={level.id}>
          <h1 className="mb-3 text-2xl font-bold"><span className="mr-2 rounded-lg bg-brand-600 px-2 py-0.5 text-white">{level.code}</span>{level.name}</h1>
          <div className="grid gap-3 sm:grid-cols-2">
            {level.chapters.map((c) => {
              const done = c.lessons.filter((l) => l.status === "COMPLETED").length;
              const inner = (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chapter {c.order}</p>
                      <h2 className="text-lg font-semibold">{c.title}</h2>
                    </div>
                    {!c.accessible && <span aria-label="Locked">🔒</span>}
                    {c.weeklyTest?.passed && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Weekly ✓</span>}
                  </div>
                  <ProgressBar className="mt-3" value={(done / Math.max(1, c.lessons.length)) * 100} tone={done === c.lessons.length && done > 0 ? "green" : "brand"} />
                  <p className="mt-1 text-xs text-slate-500">{done} / {c.lessons.length} days</p>
                </>
              );
              return c.accessible ? (
                <Link key={c.id} href={`/chapters/${c.id}`} className="card block p-4 transition hover:border-brand-200 hover:shadow">{inner}</Link>
              ) : (
                <div key={c.id} className="card p-4 opacity-60">{inner}</div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
