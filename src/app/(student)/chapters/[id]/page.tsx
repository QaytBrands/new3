import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { getStudentCurriculum } from "@/server/student-data";
import { LessonRow } from "@/components/student/LessonRow";

export default async function ChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent();
  const levels = await getStudentCurriculum(user.id);
  const level = levels.find((l) => l.chapters.some((c) => c.id === id));
  const chapter = level?.chapters.find((c) => c.id === id);
  if (!level || !chapter || !chapter.accessible) notFound();
  const accessibleLessons = chapter.lessons.filter((l) => l.accessible);
  const allDone = accessibleLessons.length > 0 && accessibleLessons.every((l) => l.status === "COMPLETED");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/levels" className="text-sm text-slate-500">← {level.code} {level.name}</Link>
      <h1 className="mb-4 mt-1 text-2xl font-bold">Chapter {chapter.order}: {chapter.title}</h1>
      <div className="card divide-y divide-slate-100 p-2">
        {chapter.lessons.map((l) => <LessonRow key={l.id} lesson={l} />)}
        {chapter.weeklyTest && (
          <div className="flex items-center gap-3 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">📝</span>
            <div className="flex-1">
              <p className="font-medium">Weekly test</p>
              <p className="text-xs text-slate-500">
                {chapter.weeklyTest.passed ? `Passed · best ${chapter.weeklyTest.bestPercentage}%` : allDone ? "Ready when you are" : "Complete the days first (recommended)"}
              </p>
            </div>
            <Link href={`/tests/${chapter.weeklyTest.id}`} className={allDone ? "btn-primary" : "btn-secondary"}>Open</Link>
          </div>
        )}
      </div>
    </div>
  );
}
