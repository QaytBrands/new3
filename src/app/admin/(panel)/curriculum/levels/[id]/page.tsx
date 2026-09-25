import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCurriculumViewer } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { ActionForm, Checkbox, Field } from "@/components/admin/ActionForm";
import { deleteLevel, saveChapter, saveLevel } from "@/server/admin/curriculum";

export default async function LevelAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurriculumViewer();
  const level = await prisma.level.findUnique({ where: { id }, include: { chapters: { orderBy: { order: "asc" }, include: { _count: { select: { lessons: true } } } } } });
  if (!level) notFound();
  const canLevels = hasPermission(user, "MANAGE_LEVELS");
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/curriculum" className="text-sm text-slate-500">← Curriculum</Link>
        <h1 className="text-xl font-bold">{level.code} · {level.name}</h1>
      </div>
      {canLevels && (
        <section className="card p-4">
          <ActionForm action={saveLevel}>
            <input type="hidden" name="id" value={level.id} />
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Code"><input className="input" name="code" defaultValue={level.code} required /></Field>
              <Field label="Name"><input className="input" name="name" defaultValue={level.name} required /></Field>
              <Field label="Order"><input className="input" type="number" name="order" defaultValue={level.order} /></Field>
              <Field label="Words per lesson"><input className="input" type="number" name="wordsPerLesson" defaultValue={level.wordsPerLesson} /></Field>
            </div>
            <Field label="Description"><input className="input" name="description" defaultValue={level.description ?? ""} /></Field>
            <Checkbox name="published" label="Published (visible to students with access)" defaultChecked={level.published} />
          </ActionForm>
        </section>
      )}
      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Chapters</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {level.chapters.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <Link href={`/admin/curriculum/chapters/${c.id}`} className="text-brand-700">{c.order}. {c.title}</Link>
              <span className="text-slate-500">{c._count.lessons} days</span>
            </li>
          ))}
        </ul>
        {hasPermission(user, "MANAGE_CHAPTERS") && (
          <ActionForm action={saveChapter} submitLabel="Add chapter" resetOnSuccess className="mt-4 border-t border-slate-100 pt-4">
            <input type="hidden" name="levelId" value={level.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Title"><input className="input" name="title" required /></Field>
              <Field label="Order"><input className="input" type="number" name="order" defaultValue={level.chapters.length + 1} /></Field>
              <Field label="Description"><input className="input" name="description" /></Field>
            </div>
          </ActionForm>
        )}
      </section>
      {canLevels && (
        <ActionForm action={deleteLevel} submitLabel="Delete level" variant="danger" confirm="Delete this level with ALL chapters, lessons, words, tests and related progress?">
          <input type="hidden" name="id" value={level.id} />
        </ActionForm>
      )}
    </div>
  );
}
