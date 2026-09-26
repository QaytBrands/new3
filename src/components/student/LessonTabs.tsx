import Link from "next/link";
import clsx from "clsx";

export function LessonTabs({ lessonId, active }: { lessonId: string; active: "learn" | "practice" | "pronounce" }) {
  const tabs = [
    { key: "learn", href: `/lessons/${lessonId}`, label: "Learn" },
    { key: "practice", href: `/lessons/${lessonId}/practice`, label: "Sentences" },
    { key: "pronounce", href: `/lessons/${lessonId}/pronounce`, label: "Pronounce" },
  ] as const;
  return (
    <div className="mb-5 flex justify-center">
      <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} className={clsx("rounded-lg px-4 py-1.5 text-sm font-medium", active === t.key ? "bg-white shadow-sm" : "text-slate-600")}>
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
