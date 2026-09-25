import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { QUESTION_TYPE_LABELS, type PromptData } from "@/lib/tests/types";

export default async function AttemptDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("VIEW_TEST_RESULTS");
  const a = await prisma.testAttempt.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      test: { select: { title: true, passingScore: true } },
      answers: { orderBy: { position: "asc" }, include: { pronunciationAttempt: { select: { audioUrl: true, transcript: true } } } },
    },
  });
  if (!a) notFound();
  return (
    <div className="space-y-4">
      <Link href="/admin/results" className="text-sm text-slate-500">← Results</Link>
      <h1 className="text-xl font-bold">{a.user.name} — {a.test.title} (attempt {a.attemptNumber})</h1>
      <p className="text-sm text-slate-600">
        {a.completedAt ? `${a.correctCount}/${a.total} correct · ${a.percentage}% · ${a.passed ? "passed" : "failed"} (pass ${a.test.passingScore}%) · ${a.durationSec}s · ${a.completedAt.toLocaleString()}` : "In progress"}
      </p>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>#</th><th>Type</th><th>Prompt</th><th>Answer</th><th>Correct answer</th><th></th></tr></thead>
          <tbody>
            {a.answers.map((x) => {
              const pd = x.promptData as PromptData | null;
              return (
                <tr key={x.id}>
                  <td>{x.position + 1}</td>
                  <td className="text-xs">{QUESTION_TYPE_LABELS[x.questionType]}</td>
                  <td>{x.questionType === "SENTENCE" ? pd?.sentence : x.questionType === "LISTENING" ? pd?.audioText : x.prompt}</td>
                  <td>
                    {x.givenAnswer ?? <span className="text-slate-400">—</span>}
                    {x.pronunciationAttempt?.audioUrl && <audio controls preload="none" src={x.pronunciationAttempt.audioUrl} className="mt-1 h-8" />}
                  </td>
                  <td>{x.correctAnswer}</td>
                  <td>{x.isCorrect === null ? <span className="text-slate-400">not scored</span> : x.isCorrect ? "✓" : <span className="text-rose-600">✗</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
