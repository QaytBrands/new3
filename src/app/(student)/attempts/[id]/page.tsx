import { formatDateTime } from "@/lib/time";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth/guards";
import { getAttemptForRunner, isExpired } from "@/server/test-service";
import { TestRunner } from "@/components/student/TestRunner";
import { QUESTION_TYPE_LABELS, type PromptData } from "@/lib/tests/types";

function formatDuration(sec: number | null) {
  if (sec == null) return "—";
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent();
  const attempt = await prisma.testAttempt.findFirst({
    where: { id, userId: user.id },
    include: { test: true },
  });
  if (!attempt) notFound();

  if (!attempt.completedAt && !isExpired(attempt.startedAt, attempt.test.timeLimitSec)) {
    const runner = await getAttemptForRunner(user.id, id);
    return (
      <TestRunner
        attemptId={id}
        title={attempt.test.title}
        timeLimitSec={attempt.test.timeLimitSec}
        startedAt={attempt.startedAt.toISOString()}
        questions={runner!.answers}
      />
    );
  }
  if (!attempt.completedAt) {
    return (
      <div className="card mx-auto max-w-md p-6 text-center">
        <p>Time ran out for this attempt.</p>
        <Link href={`/tests/${attempt.testId}`} className="btn-primary mt-4">Back to test</Link>
      </div>
    );
  }

  const answers = await prisma.testAnswer.findMany({
    where: { attemptId: id },
    orderBy: { position: "asc" },
    include: { pronunciationAttempt: { select: { transcript: true, transcriptMatches: true } } },
  });
  const wrong = answers.filter((a) => a.isCorrect === false);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className={clsx("card p-6 text-center", attempt.passed ? "border-emerald-200" : "border-amber-200")}>
        <p className="text-5xl">{attempt.passed ? "🎉" : "💪"}</p>
        <h1 className="mt-2 text-3xl font-bold">{attempt.percentage}%</h1>
        <p className={attempt.passed ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
          {attempt.passed ? "Passed!" : `Not passed — ${attempt.test.passingScore}% needed`}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-emerald-50 p-2"><b>{attempt.correctCount}</b> correct</div>
          <div className="rounded-lg bg-rose-50 p-2"><b>{attempt.incorrectCount}</b> incorrect</div>
          <div className="rounded-lg bg-slate-50 p-2">{formatDuration(attempt.durationSec)}</div>
        </div>
        <p className="mt-3 text-xs text-slate-400">Attempt {attempt.attemptNumber} · {formatDateTime(attempt.completedAt, user.timezone)}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href={`/tests/${attempt.testId}`} className="btn-secondary">Try again</Link>
          <Link href="/dashboard" className="btn-primary">Continue learning</Link>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{wrong.length ? `Review ${wrong.length} incorrect answer${wrong.length > 1 ? "s" : ""}` : "All answers"}</h2>
        <ol className="space-y-2">
          {(wrong.length ? wrong : answers).map((a) => {
            const pd = a.promptData as PromptData | null;
            return (
              <li key={a.id} className="card p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">{QUESTION_TYPE_LABELS[a.questionType]}</p>
                <p className="mt-1 font-medium">{a.questionType === "SENTENCE" ? pd?.sentence : a.questionType === "LISTENING" ? `🔊 ${pd?.audioText}` : a.prompt}</p>
                {a.questionType === "PRONUNCIATION" ? (
                  <p className="mt-1 text-sm text-slate-600">
                    {a.pronunciationAttempt ? `Recorded${a.pronunciationAttempt.transcript ? ` — heard “${a.pronunciationAttempt.transcript}”` : ""}` : "Not recorded"}
                    <span className="text-slate-400"> · not scored</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm">
                    {a.isCorrect ? (
                      <span className="text-emerald-700">✓ {a.givenAnswer}</span>
                    ) : (
                      <>
                        <span className="text-rose-600 line-through">{a.givenAnswer || "(no answer)"}</span>{" "}
                        <span className="font-semibold text-emerald-700">→ {a.correctAnswer}</span>
                      </>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
