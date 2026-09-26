import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCurriculumViewer } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { deleteChapter, saveChapter, saveLesson } from "@/server/admin/curriculum";

export default async function ChapterAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurriculumViewer();
  const chapter = await prisma.chapter.findUnique({
    where: { id },
    include: {
      level: true,
      tests: true,
      lessons: { orderBy: [{ order: "asc" }, { dayNumber: "asc" }], include: { _count: { select: { vocabulary: true } }, tests: { select: { id: true } } } },
    },
  });
  if (!chapter) notFound();
  const canChapters = hasPermission(user, "MANAGE_CHAPTERS");
  const canTests = hasPermission(user, "MANAGE_TESTS");
  const nextDay = Math.max(0, ...chapter.lessons.map((l) => l.dayNumber)) + 1;
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/curriculum/levels/${chapter.levelId}`} className="text-sm text-slate-500">← {chapter.level.code} · {chapter.level.name}</Link>
        <h1 className="text-xl font-bold">Chapter {chapter.order}: {chapter.title}</h1>
      </div>
      {canChapters && (
        <section className="card p-4">
          <ActionForm action={saveChapter}>
            <input type="hidden" name="id" value={chapter.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Title"><input className="input" name="title" defaultValue={chapter.title} required /></Field>
              <Field label="Order"><input className="input" type="number" name="order" defaultValue={chapter.order} /></Field>
              <Field label="Description"><input className="input" name="description" defaultValue={chapter.description ?? ""} /></Field>
            </div>
          </ActionForm>
        </section>
      )}
      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Days</h2>
        <table className="table">
          <thead><tr><th>Day</th><th>Title</th><th>Words</th><th>Daily test</th></tr></thead>
          <tbody>
            {chapter.lessons.map((l) => (
              <tr key={l.id}>
                <td>{l.dayNumber}</td>
                <td><Link href={`/admin/curriculum/lessons/${l.id}`} className="text-brand-700">{l.title}</Link></td>
                <td>{l._count.vocabulary} / {chapter.level.wordsPerLesson}</td>
                <td>{l.tests[0] ? (canTests ? <Link href={`/admin/tests/${l.tests[0].id}`} className="text-brand-700">Edit</Link> : "Yes") : canTests ? <Link href={`/admin/tests/new?lessonId=${l.id}`} className="text-slate-500 underline">Create</Link> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {canChapters && (
          <ActionForm action={saveLesson} submitLabel="Add day" resetOnSuccess className="mt-4 border-t border-slate-100 pt-4">
            <input type="hidden" name="chapterId" value={chapter.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Day number"><input className="input" type="number" name="dayNumber" defaultValue={nextDay} min={1} required /></Field>
              <Field label="Title"><input className="input" name="title" required /></Field>
            </div>
          </ActionForm>
        )}
      </section>
      <section className="card p-4 text-sm">
        <h2 className="mb-2 font-semibold">Weekly test</h2>
        {chapter.tests[0] ? (
          canTests ? <Link className="text-brand-700" href={`/admin/tests/${chapter.tests[0].id}`}>{chapter.tests[0].title} →</Link> : <span>{chapter.tests[0].title}</span>
        ) : canTests ? (
          <Link className="btn-secondary" href={`/admin/tests/new?chapterId=${chapter.id}`}>Create weekly test</Link>
        ) : <span className="text-slate-500">None</span>}
      </section>
      {canChapters && (
        <ActionForm action={deleteChapter} submitLabel="Delete chapter" variant="danger" confirm="Delete this chapter with all its days, words and tests?">
          <input type="hidden" name="id" value={chapter.id} />
        </ActionForm>
      )}
    </div>
  );
}
