import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { ActionForm } from "@/components/admin/ActionForm";
import { TestFields } from "@/components/admin/TestFields";
import { deleteTest, saveTest } from "@/server/admin/tests";

export default async function EditTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("MANAGE_TESTS");
  const t = await prisma.test.findUnique({ where: { id }, include: { lesson: true, chapter: true } });
  if (!t) notFound();
  const back = t.lessonId ? `/admin/curriculum/lessons/${t.lessonId}` : `/admin/curriculum/chapters/${t.chapterId}`;
  return (
    <div className="space-y-4">
      <Link href={back} className="text-sm text-slate-500">← Back to {t.lesson ? `Day ${t.lesson.dayNumber}` : t.chapter?.title}</Link>
      <h1 className="text-xl font-bold">{t.title}</h1>
      <p className="text-sm text-slate-500">
        {t.kind === "DAILY" ? "Covers the words of this day." : "Covers words from the days of this chapter the student has completed."}
      </p>
      <section className="card p-4">
        <ActionForm action={saveTest}>
          <input type="hidden" name="id" value={t.id} />
          <TestFields t={t} defaults={{ title: t.title, questionCount: t.questionCount, passingScore: t.passingScore }} />
        </ActionForm>
      </section>
      <ActionForm action={deleteTest} submitLabel="Delete test" variant="danger" confirm="Delete this test and all its attempts?">
        <input type="hidden" name="id" value={t.id} />
      </ActionForm>
    </div>
  );
}
