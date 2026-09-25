import { formatDate, formatDateTime } from "@/lib/time";
import { recordingAudioPath } from "@/server/pronunciation-service";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { hasPermission, isAdmin } from "@/lib/permissions";
import { buildAccessSet, canAccessLesson } from "@/lib/access";
import { ActionForm, Checkbox, Field } from "@/components/admin/ActionForm";
import { UnlockButton } from "@/components/admin/UnlockButton";
import { TimeZoneSelect } from "@/components/admin/TimeZoneSelect";
import { deleteStudent, resetStudentProgress, updateStudent } from "@/server/admin/users";

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePagePermission("VIEW_STUDENTS");
  const student = await prisma.user.findFirst({ where: { id, role: "STUDENT" } });
  if (!student) notFound();

  const can = {
    edit: hasPermission(actor, "EDIT_STUDENTS"),
    progress: hasPermission(actor, "VIEW_PROGRESS"),
    results: hasPermission(actor, "VIEW_TEST_RESULTS"),
    unlockLevels: hasPermission(actor, "UNLOCK_LEVELS"),
    unlockChapters: hasPermission(actor, "UNLOCK_CHAPTERS"),
    admin: isAdmin(actor),
  };

  const [levels, unlocks, lessonProgress, attempts, pronunciation, vocabStats] = await Promise.all([
    prisma.level.findMany({
      orderBy: { order: "asc" },
      include: { chapters: { orderBy: { order: "asc" }, include: { lessons: { orderBy: [{ order: "asc" }, { dayNumber: "asc" }] } } } },
    }),
    prisma.unlock.findMany({ where: { userId: id } }),
    can.progress ? prisma.lessonProgress.findMany({ where: { userId: id } }) : Promise.resolve([]),
    can.results
      ? prisma.testAttempt.findMany({ where: { userId: id, completedAt: { not: null } }, orderBy: { completedAt: "desc" }, take: 30, include: { test: { select: { title: true } } } })
      : Promise.resolve([]),
    can.progress
      ? prisma.pronunciationAttempt.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { vocabulary: { select: { german: true } } } })
      : Promise.resolve([]),
    can.progress
      ? prisma.vocabularyProgress.aggregate({ where: { userId: id }, _avg: { mastery: true }, _count: { _all: true }, _sum: { timesCorrect: true, timesIncorrect: true } })
      : Promise.resolve(null),
  ]);
  const difficultWords = can.progress
    ? await prisma.vocabularyProgress.findMany({ where: { userId: id, OR: [{ difficult: true }, { timesIncorrect: { gt: 0 } }] }, orderBy: { timesIncorrect: "desc" }, take: 15, include: { vocabulary: { select: { german: true, english: true } } } })
    : [];

  const access = buildAccessSet(unlocks);
  const progressByLesson = new Map(lessonProgress.map((p) => [p.lessonId, p]));
  const source = (u: { source: string } | undefined) => (u?.source === "AUTO" ? " (auto)" : "");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/students" className="text-sm text-slate-500">← Students</Link>
        <h1 className="text-xl font-bold">{student.name} <span className="text-base font-normal text-slate-500">@{student.username}</span></h1>
        <p className="text-sm text-slate-500">Time zone: {student.timezone} · Last active: {student.lastActiveAt ? formatDateTime(student.lastActiveAt, actor.timezone) : "never"}</p>
      </div>

      {can.edit && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Account</h2>
          <ActionForm action={updateStudent}>
            <input type="hidden" name="id" value={student.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name"><input className="input" name="name" defaultValue={student.name} required /></Field>
              <Field label="Email"><input className="input" name="email" type="email" defaultValue={student.email ?? ""} /></Field>
              <Field label="New password" hint="Leave blank to keep"><input className="input" name="password" type="text" minLength={8} /></Field>
              <Field label="Time zone" hint="Used for the student's “today” and review dates"><TimeZoneSelect defaultValue={student.timezone} /></Field>
            </div>
            <Checkbox name="active" label="Account active" defaultChecked={student.active} />
          </ActionForm>
        </section>
      )}

      <section className="card p-4">
        <h2 className="mb-1 font-semibold">Access</h2>
        <p className="mb-3 text-sm text-slate-500">Students can only see content unlocked here. Unlocking a level grants all its chapters; a chapter grants all its days.</p>
        <div className="space-y-4">
          {levels.map((level) => {
            const lu = unlocks.find((u) => u.scope === "LEVEL" && u.levelId === level.id);
            return (
              <div key={level.id} className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="font-semibold">{level.code} · {level.name}{source(lu)}</span>
                  <UnlockButton userId={id} scope="LEVEL" targetId={level.id} unlocked={!!lu} disabled={!can.unlockLevels} />
                </div>
                <ul className="divide-y divide-slate-100">
                  {level.chapters.map((c) => {
                    const cu = unlocks.find((u) => u.scope === "CHAPTER" && u.chapterId === c.id);
                    return (
                      <li key={c.id} className="px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{c.title}{source(cu)}{lu && <span className="ml-2 text-xs text-slate-400">via level</span>}</span>
                          <UnlockButton userId={id} scope="CHAPTER" targetId={c.id} unlocked={!!cu} disabled={!can.unlockChapters} />
                        </div>
                        <ul className="mt-1 flex flex-wrap gap-2">
                          {c.lessons.map((l) => {
                            const les = unlocks.find((u) => u.scope === "LESSON" && u.lessonId === l.id);
                            const accessible = canAccessLesson(access, { id: l.id, chapterId: c.id, levelId: level.id });
                            const p = progressByLesson.get(l.id);
                            return (
                              <li key={l.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs">
                                <span className={accessible ? "text-slate-800" : "text-slate-400"}>
                                  Day {l.dayNumber}{p?.status === "COMPLETED" ? " ✓" : p ? " …" : ""}{source(les)}
                                </span>
                                {!lu && !cu && <UnlockButton userId={id} scope="LESSON" targetId={l.id} unlocked={!!les} disabled={!can.unlockChapters} />}
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {can.progress && vocabStats && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Progress</h2>
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <div><p className="label">Lessons completed</p><p className="text-lg font-bold">{lessonProgress.filter((p) => p.status === "COMPLETED").length}</p></div>
            <div><p className="label">Words practised</p><p className="text-lg font-bold">{vocabStats._count._all}</p></div>
            <div><p className="label">Avg mastery</p><p className="text-lg font-bold">{Math.round((vocabStats._avg.mastery ?? 0) * 100)}%</p></div>
            <div><p className="label">Answers ✓ / ✗</p><p className="text-lg font-bold">{vocabStats._sum.timesCorrect ?? 0} / {vocabStats._sum.timesIncorrect ?? 0}</p></div>
          </div>
          {difficultWords.length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-sm font-semibold">Struggling / difficult words</h3>
              <table className="table">
                <thead><tr><th>Word</th><th>Seen</th><th>✓</th><th>✗</th><th>Mastery</th><th>Next review</th></tr></thead>
                <tbody>
                  {difficultWords.map((w) => (
                    <tr key={w.id}>
                      <td>{w.vocabulary.german} <span className="text-slate-400">({w.vocabulary.english})</span>{w.difficult && " ★"}</td>
                      <td>{w.timesSeen}</td><td>{w.timesCorrect}</td><td>{w.timesIncorrect}</td>
                      <td>{Math.round(w.mastery * 100)}%</td>
                      <td>{formatDate(w.nextReviewAt, student.timezone)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      {can.results && (
        <section className="card overflow-x-auto p-4">
          <h2 className="mb-3 font-semibold">Test results</h2>
          {attempts.length === 0 ? <p className="text-sm text-slate-500">No tests taken.</p> : (
            <table className="table">
              <thead><tr><th>Test</th><th>#</th><th>Score</th><th>Result</th><th>Time</th><th>Date</th></tr></thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td><Link className="text-brand-700" href={`/admin/results/${a.id}`}>{a.test.title}</Link></td>
                    <td>{a.attemptNumber}</td>
                    <td>{a.correctCount}/{a.total} ({a.percentage}%)</td>
                    <td>{a.passed ? <span className="text-emerald-600">Passed</span> : <span className="text-rose-600">Failed</span>}</td>
                    <td>{a.durationSec != null ? `${Math.floor(a.durationSec / 60)}m ${a.durationSec % 60}s` : "—"}</td>
                    <td>{formatDateTime(a.completedAt, actor.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {can.progress && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Pronunciation attempts</h2>
          {pronunciation.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {pronunciation.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-32 font-medium">{p.vocabulary.german}</span>
                  <span className="text-slate-500">{p.transcript ? `heard “${p.transcript}” ${p.transcriptMatches ? "✓" : "✗"}` : "no transcript"}</span>
                  {p.audioKey && <audio controls preload="none" src={recordingAudioPath(p.id)} className="h-8" />}
                  <span className="ml-auto text-xs text-slate-400">{formatDateTime(p.createdAt, actor.timezone)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {can.admin && (
        <section className="card border-rose-200 p-4">
          <h2 className="mb-3 font-semibold text-rose-700">Danger zone</h2>
          <div className="flex flex-wrap items-end gap-6">
            <ActionForm action={resetStudentProgress} submitLabel="Reset progress" variant="danger" confirm="Reset this student's progress? This cannot be undone.">
              <input type="hidden" name="id" value={id} />
              <Field label="What to reset">
                <select name="scope" className="input">
                  <option value="all">Everything (lessons, words, tests, recordings)</option>
                  <option value="lessons">Lesson & vocabulary progress</option>
                  <option value="tests">Test attempts only</option>
                </select>
              </Field>
            </ActionForm>
            <ActionForm action={deleteStudent} submitLabel="Delete student" variant="danger" confirm="Permanently delete this student and all their data?">
              <input type="hidden" name="id" value={id} />
            </ActionForm>
          </div>
        </section>
      )}
    </div>
  );
}
