import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth/guards";
import { getStudentCurriculum } from "@/server/student-data";
import { GermanWord } from "@/components/ui/ArticleBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AudioButton } from "@/components/ui/AudioButton";

export const metadata = { title: "My words" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "review", label: "Due for review" },
  { key: "difficult", label: "Difficult" },
  { key: "mastered", label: "Mastered" },
] as const;

export default async function WordsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter = "all" } = await searchParams;
  const user = await requireStudent();
  const levels = await getStudentCurriculum(user.id);
  const lessonIds = levels.flatMap((l) => l.chapters.flatMap((c) => c.lessons.filter((x) => x.accessible && x.status !== "NOT_STARTED").map((x) => x.id)));
  const vocab = await prisma.vocabulary.findMany({
    where: { lessonId: { in: lessonIds } },
    orderBy: [{ lesson: { chapter: { order: "asc" } } }, { lesson: { order: "asc" } }, { order: "asc" }],
    include: { progress: { where: { userId: user.id } }, lesson: { select: { dayNumber: true, chapter: { select: { title: true } } } } },
  });
  const now = new Date();
  const rows = vocab
    .map((v) => ({ v, p: v.progress[0] }))
    .filter(({ p }) => {
      if (filter === "review") return !!p && ((p.nextReviewAt && p.nextReviewAt <= now) || p.difficult);
      if (filter === "difficult") return !!p?.difficult;
      if (filter === "mastered") return (p?.mastery ?? 0) >= 0.8;
      return true;
    });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My words</h1>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/words?filter=${f.key}`} className={clsx("shrink-0 rounded-full px-3 py-1.5 text-sm font-medium", filter === f.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}>
            {f.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-slate-500">No words here yet.</p>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {rows.map(({ v, p }) => (
            <li key={v.id} className="flex items-center gap-3 p-3">
              <AudioButton text={v.article ? `${v.article.toLowerCase()} ${v.german}` : v.german} audioUrl={v.audioUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold"><GermanWord german={v.german} article={v.article} />{p?.difficult && <span className="ml-1 text-amber-500">★</span>}</p>
                <p className="truncate text-sm text-slate-500">{v.english} · {v.lesson.chapter.title}, Day {v.lesson.dayNumber}</p>
              </div>
              <div className="w-24 shrink-0 text-right">
                <ProgressBar value={(p?.mastery ?? 0) * 100} tone={(p?.mastery ?? 0) >= 0.8 ? "green" : "brand"} />
                <p className="mt-1 text-[11px] text-slate-500">{p ? `${p.timesCorrect}✓ ${p.timesIncorrect}✗` : "new"}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
