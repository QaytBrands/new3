import Link from "next/link";
import { requireStudent } from "@/lib/auth/guards";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GermanWord } from "@/components/ui/ArticleBadge";
import { findNextActivity, getMasterySummary, getRecentMistakes, getRevisionWords, getStudentCurriculum, type TestStatus } from "@/server/student-data";

export const metadata = { title: "Dashboard" };

function TestPill({ status, label }: { status: TestStatus; label: string }) {
  if (!status) return <span className="text-slate-400">No {label.toLowerCase()}</span>;
  const tone = status.passed ? "bg-emerald-50 text-emerald-700" : status.attempts ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600";
  const text = status.passed ? `Passed · best ${status.bestPercentage}%` : status.attempts ? `Not passed yet · best ${status.bestPercentage}%` : "Not taken";
  return (
    <Link href={`/tests/${status.id}`} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{text}</Link>
  );
}

export default async function Dashboard() {
  const user = await requireStudent();
  const levels = await getStudentCurriculum(user.id);
  const [revision, mistakes, mastery] = await Promise.all([
    getRevisionWords(user.id),
    getRecentMistakes(user.id),
    getMasterySummary(user.id, levels),
  ]);

  if (levels.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl font-bold">Hallo, {user.name}!</h1>
        <p className="mt-2 text-slate-500">No lessons have been unlocked for you yet. Your teacher will unlock your first chapter soon.</p>
      </div>
    );
  }

  const next = findNextActivity(levels, revision.length > 0);
  const lessons = levels.flatMap((l) => l.chapters.flatMap((c) => c.lessons.filter((x) => x.accessible)));
  const completed = lessons.filter((l) => l.status === "COMPLETED").length;
  const overall = lessons.length ? (completed / lessons.length) * 100 : 0;
  const ctx = "level" in next ? next : null;
  const currentChapter = ctx?.chapter;
  const today = next.kind === "lesson" || next.kind === "daily-test" ? next.lesson : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{ctx ? `${ctx.level.code} · ${ctx.level.name}` : "All caught up"}</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Hallo, {user.name.split(" ")[0]}! 👋</h1>
      </div>

      <section className="card overflow-hidden bg-gradient-to-br from-brand-600 to-brand-700 text-white">
        <div className="p-6 sm:p-8">
          <p className="text-sm font-medium text-brand-100">
            {next.kind === "lesson" && `Today · ${currentChapter?.title} · Day ${today?.dayNumber}`}
            {next.kind === "daily-test" && `${currentChapter?.title} · Day ${today?.dayNumber} test`}
            {next.kind === "weekly-test" && `${currentChapter?.title} · Weekly test`}
            {next.kind === "review" && "Revision"}
            {next.kind === "done" && "Great work"}
          </p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
            {next.kind === "lesson" ? today?.title : next.kind === "review" ? `${revision.length} words to review` : next.kind === "done" ? "You’ve finished everything unlocked" : next.label}
          </h2>
          {today && next.kind === "lesson" && (
            <p className="mt-2 text-brand-100">{Math.max(0, today.wordCount - today.seenCount)} of {today.wordCount} words remaining today</p>
          )}
          <Link href={next.href} className="btn btn-lg mt-5 bg-white text-brand-700 shadow hover:bg-brand-50">{next.label} →</Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <p className="label">Current chapter</p>
          <p className="font-semibold">{currentChapter?.title ?? "—"}</p>
          {currentChapter && (
            <ProgressBar className="mt-2" value={(currentChapter.lessons.filter((l) => l.status === "COMPLETED").length / Math.max(1, currentChapter.lessons.length)) * 100} />
          )}
        </div>
        <div className="card p-4">
          <p className="label">Overall progress</p>
          <p className="text-2xl font-bold">{Math.round(overall)}%</p>
          <p className="text-xs text-slate-500">{completed} of {lessons.length} lessons</p>
        </div>
        <div className="card p-4">
          <p className="label">Vocabulary mastery</p>
          <p className="text-2xl font-bold">{Math.round(mastery.averageMastery * 100)}%</p>
          <p className="text-xs text-slate-500">{mastery.masteredWords} mastered · {mastery.seenWords}/{mastery.totalWords} seen</p>
        </div>
        <div className="card space-y-2 p-4">
          <div>
            <p className="label">Daily test</p>
            {today ? <TestPill status={today.dailyTest} label="Daily test" /> : <span className="text-sm text-slate-400">—</span>}
          </div>
          <div>
            <p className="label">Weekly test</p>
            {currentChapter ? <TestPill status={currentChapter.weeklyTest} label="Weekly test" /> : <span className="text-sm text-slate-400">—</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Revision words</h3>
            <Link href="/words?filter=review" className="text-sm text-brand-600">See all</Link>
          </div>
          {revision.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing due for review. 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {revision.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <GermanWord german={r.vocabulary.german} article={r.vocabulary.article} className="font-medium" />
                  <span className="text-sm text-slate-500">{r.vocabulary.english}{r.difficult && " ★"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h3 className="mb-3 font-semibold">Recent mistakes</h3>
          {mistakes.length === 0 ? (
            <p className="text-sm text-slate-500">No mistakes yet — keep it up!</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {mistakes.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <GermanWord german={m.vocabulary.german} article={m.vocabulary.article} className="font-medium" />
                  <span className="text-sm text-slate-500">{m.vocabulary.english}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
