import { formatDateTime } from "@/lib/time";
import { recordingAudioPath } from "@/server/pronunciation-service";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth/guards";

export const metadata = { title: "Pronunciation" };

export default async function PronunciationAdmin({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePageAdmin();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const take = 50;
  const [rows, total] = await Promise.all([
    prisma.pronunciationAttempt.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: { user: { select: { id: true, name: true } }, vocabulary: { select: { german: true, ipa: true } } },
    }),
    prisma.pronunciationAttempt.count(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pronunciation attempts <span className="text-base font-normal text-slate-500">({total})</span></h1>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Student</th><th>Word</th><th>Transcript</th><th>Match</th><th>Score</th><th>Recording</th><th>When</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link className="text-brand-700" href={`/admin/students/${r.user.id}`}>{r.user.name}</Link></td>
                <td>{r.vocabulary.german} {r.vocabulary.ipa && <span className="font-mono text-xs text-slate-400">/{r.vocabulary.ipa}/</span>}</td>
                <td>{r.transcript ?? <span className="text-slate-400">—</span>}</td>
                <td>{r.transcriptMatches == null ? "—" : r.transcriptMatches ? "✓" : "✗"}</td>
                <td>{r.score != null ? Math.round(r.score) : <span className="text-slate-400">n/a</span>}</td>
                <td>{r.audioKey ? <audio controls preload="none" src={recordingAudioPath(r.id)} className="h-8" /> : "—"}</td>
                <td className="text-slate-500">{formatDateTime(r.createdAt, user.timezone)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        {page > 1 && <Link className="btn-secondary" href={`?page=${page - 1}`}>← Newer</Link>}
        {page * take < total && <Link className="btn-secondary" href={`?page=${page + 1}`}>Older →</Link>}
      </div>
    </div>
  );
}
