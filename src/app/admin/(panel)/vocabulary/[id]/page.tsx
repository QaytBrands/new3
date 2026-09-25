import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { VocabularyFields } from "@/components/admin/VocabularyFields";
import { deleteSentence, deleteVocabulary, saveSentence, updateVocabulary } from "@/server/admin/curriculum";

export default async function VocabularyAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff();
  const canVocab = hasPermission(user, "MANAGE_VOCABULARY");
  const canSentences = hasPermission(user, "MANAGE_SENTENCES");
  if (!canVocab && !canSentences) redirect("/admin/forbidden");
  const v = await prisma.vocabulary.findUnique({
    where: { id },
    include: { sentences: { orderBy: { order: "asc" } }, lesson: { include: { chapter: { include: { level: true } } } } },
  });
  if (!v) notFound();
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/curriculum/lessons/${v.lessonId}`} className="text-sm text-slate-500">← {v.lesson.chapter.level.code} · {v.lesson.chapter.title} · Day {v.lesson.dayNumber}</Link>
        <h1 className="text-xl font-bold">{v.article?.toLowerCase()} {v.german}</h1>
      </div>
      {canVocab && (
        <section className="card p-4">
          <ActionForm action={updateVocabulary}>
            <input type="hidden" name="id" value={v.id} />
            <VocabularyFields v={v} />
            <Field label="Order in lesson" className="max-w-40"><input className="input" type="number" name="order" defaultValue={v.order} /></Field>
          </ActionForm>
        </section>
      )}
      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Example sentences</h2>
        <div className="space-y-4">
          {v.sentences.map((s) =>
            canSentences ? (
              <div key={s.id} className="rounded-lg border border-slate-200 p-3">
                <ActionForm action={saveSentence}>
                  <input type="hidden" name="id" value={s.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="German"><input className="input" name="german" defaultValue={s.german} required /></Field>
                    <Field label="English"><input className="input" name="english" defaultValue={s.english} required /></Field>
                    <Field label="Audio URL"><input className="input" name="audioUrl" defaultValue={s.audioUrl ?? ""} /></Field>
                  </div>
                </ActionForm>
                <ActionForm action={deleteSentence} submitLabel="Delete" variant="secondary" inline confirm="Delete this sentence?" className="mt-2">
                  <input type="hidden" name="id" value={s.id} />
                </ActionForm>
              </div>
            ) : (
              <p key={s.id}>{s.german} — <span className="text-slate-500">{s.english}</span></p>
            ),
          )}
          {v.sentences.length === 0 && <p className="text-sm text-slate-500">No sentences yet.</p>}
        </div>
        {canSentences && (
          <ActionForm action={saveSentence} submitLabel="Add sentence" resetOnSuccess className="mt-4 border-t border-slate-100 pt-4">
            <input type="hidden" name="vocabularyId" value={v.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="German"><input className="input" name="german" required /></Field>
              <Field label="English"><input className="input" name="english" required /></Field>
              <Field label="Audio URL"><input className="input" name="audioUrl" /></Field>
            </div>
          </ActionForm>
        )}
      </section>
      {canVocab && (
        <ActionForm action={deleteVocabulary} submitLabel="Delete word" variant="danger" confirm="Delete this word and its progress data?">
          <input type="hidden" name="id" value={v.id} />
        </ActionForm>
      )}
    </div>
  );
}
