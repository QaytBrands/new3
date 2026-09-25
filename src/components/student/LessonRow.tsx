import Link from "next/link";
import clsx from "clsx";
import type { LessonNode } from "@/server/student-data";

export function LessonRow({ lesson }: { lesson: LessonNode }) {
  const done = lesson.status === "COMPLETED";
  const body = (
    <>
      <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold", done ? "bg-emerald-100 text-emerald-700" : lesson.accessible ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400")}>
        {done ? "✓" : lesson.accessible ? lesson.dayNumber : "🔒"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Day {lesson.dayNumber}: {lesson.title}</span>
        <span className="block text-xs text-slate-500">
          {lesson.wordCount} words
          {lesson.accessible && lesson.status === "IN_PROGRESS" && ` · ${lesson.seenCount} seen`}
          {lesson.dailyTest?.passed && " · test passed"}
        </span>
      </span>
    </>
  );
  return lesson.accessible ? (
    <Link href={`/lessons/${lesson.id}`} className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50">{body}</Link>
  ) : (
    <div className="flex items-center gap-3 rounded-xl p-3 opacity-60" aria-disabled>{body}</div>
  );
}
