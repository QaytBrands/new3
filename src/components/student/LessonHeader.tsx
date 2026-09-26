import Link from "next/link";

export function LessonHeader({ lesson }: { lesson: { title: string; dayNumber: number; chapter: { id: string; title: string; level: { code: string } } } }) {
  return (
    <div className="mb-4 text-center">
      <Link href={`/chapters/${lesson.chapter.id}`} className="text-sm text-slate-500">{lesson.chapter.level.code} · {lesson.chapter.title}</Link>
      <h1 className="text-xl font-bold">Day {lesson.dayNumber}: {lesson.title}</h1>
    </div>
  );
}
