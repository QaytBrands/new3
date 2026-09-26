import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCurriculumViewer } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { VocabularyFields } from "@/components/admin/VocabularyFields";
import { createVocabulary, deleteLesson, saveLesson } from "@/server/admin/curriculum";

export default async function LessonAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurriculumViewer();
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      chapter: { include: { level: true } },
      tests: { select: { id: true, title: true } },
      vocabulary: { orderBy: { order: "asc" }, include: { _count: { select: { sentences: true } } } },
    },
  });
  if (!lesson) notFound();
  const canChapters = hasPermission(user, "MANAGE_CHAPTERS");
  const canVocab = hasPermission(user, "MANAGE_VOCABULARY");
  const canOpenWord = canVocab || hasPermission(user, "MANAGE_SENTENCES");
  const full = lesson.vocabulary.length >= lesson.chapter.level.wordsPerLesson;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/curriculum/chapters/${lesson.chapterId}`} className="text-sm text-slate-500">← {lesson.chapter.level.code} · {lesson.chapter.title}</Link>
        <h1 className="text-xl font-bold">Day {lesson.dayNumber}: {lesson.title}</h1>
        <p className="text-sm text-slate-500">{lesson.vocabulary.length} / {lesson.chapter.level.wordsPerLesson} words · Daily test: {lesson.tests[0]?.title ?? "none"}</p>
      </div>
      {canChapters && (
        <section className="card p-4">
          <ActionForm action={saveLesson}>
            <input type="hidden" name="id" value={lesson.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Day number"><input className="input" type="number" name="dayNumber" defaultValue={lesson.dayNumber} min={1} /></Field>
              <Field label="Title"><input className="input" name="title" defaultValue={lesson.title} required /></Field>
            </div>
          </ActionForm>
        </section>
      )}
      <section className="card overflow-x-auto p-4">
        <h2 className="mb-2 font-semibold">Vocabulary</h2>
        <table className="table">
          <thead><tr><th>#</th><th>German</th><th>English</th><th>Plural</th><th>IPA</th><th>Learner</th><th>Sentences</th></tr></thead>
          <tbody>
            {lesson.vocabulary.map((v) => (
              <tr key={v.id}>
                <td>{v.order}</td>
                <td>{canOpenWord ? <Link href={`/admin/vocabulary/${v.id}`} className="text-brand-700">{v.article?.toLowerCase()} {v.german}</Link> : <>{v.article?.toLowerCase()} {v.german}</>}</td>
                <td>{v.english}</td>
                <td>{v.plural ?? "—"}</td>
                <td className="font-mono text-xs">{v.ipa ?? "—"}</td>
                <td>{v.phonetic ?? "—"}</td>
                <td>{v._count.sentences}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {canVocab && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Add word</h2>
          {full ? (
            <p className="text-sm text-amber-700">This lesson has reached the level’s limit of {lesson.chapter.level.wordsPerLesson} words.</p>
          ) : (
            <ActionForm action={createVocabulary} submitLabel="Add word" resetOnSuccess>
              <input type="hidden" name="lessonId" value={lesson.id} />
              <VocabularyFields />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Example sentence (German)"><input className="input" name="exampleGerman" /></Field>
                <Field label="Example translation (English)"><input className="input" name="exampleEnglish" /></Field>
              </div>
            </ActionForm>
          )}
        </section>
      )}
      {canChapters && (
        <ActionForm action={deleteLesson} submitLabel="Delete day" variant="danger" confirm="Delete this day with all its words and daily test?">
          <input type="hidden" name="id" value={lesson.id} />
        </ActionForm>
      )}
    </div>
  );
}
