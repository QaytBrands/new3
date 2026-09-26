import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCurriculumViewer } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { ActionForm, Checkbox, Field } from "@/components/admin/ActionForm";
import { saveLevel } from "@/server/admin/curriculum";

export const metadata = { title: "Curriculum" };

export default async function CurriculumPage() {
  const user = await requireCurriculumViewer();
  const [levels, settings] = await Promise.all([
    prisma.level.findMany({
      orderBy: { order: "asc" },
      include: { chapters: { orderBy: { order: "asc" }, include: { _count: { select: { lessons: true } }, lessons: { select: { _count: { select: { vocabulary: true } } } } } } },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Curriculum</h1>
      {levels.map((l) => (
        <section key={l.id} className="card p-4">
          <div className="flex items-center justify-between">
            <Link href={`/admin/curriculum/levels/${l.id}`} className="text-lg font-semibold text-brand-700">{l.code} · {l.name}</Link>
            <span className="text-xs text-slate-500">{l.published ? "Published" : "Hidden"} · {l.wordsPerLesson} words/lesson</span>
          </div>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {l.chapters.map((c) => (
              <li key={c.id} className="flex justify-between py-1.5">
                <Link href={`/admin/curriculum/chapters/${c.id}`} className="text-slate-800 hover:underline">{c.order}. {c.title}</Link>
                <span className="text-slate-500">{c._count.lessons} days · {c.lessons.reduce((a, x) => a + x._count.vocabulary, 0)} words</span>
              </li>
            ))}
            {l.chapters.length === 0 && <li className="py-1.5 text-slate-400">No chapters yet.</li>}
          </ul>
        </section>
      ))}
      {hasPermission(user, "MANAGE_LEVELS") && (
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold">+ New level</summary>
          <ActionForm action={saveLevel} submitLabel="Create level" resetOnSuccess className="mt-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Code"><input className="input" name="code" placeholder="B1" required /></Field>
              <Field label="Name"><input className="input" name="name" placeholder="Intermediate" required /></Field>
              <Field label="Order"><input className="input" type="number" name="order" defaultValue={levels.length + 1} /></Field>
              <Field label="Words per lesson"><input className="input" type="number" name="wordsPerLesson" defaultValue={settings?.defaultWordsPerLesson ?? 15} /></Field>
            </div>
            <Field label="Description"><input className="input" name="description" /></Field>
            <Checkbox name="published" label="Published" defaultChecked />
          </ActionForm>
        </details>
      )}
    </div>
  );
}
