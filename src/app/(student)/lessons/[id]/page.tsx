import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth/guards";
import { getAccessibleLesson } from "@/server/student-data";
import { LessonPlayer } from "@/components/student/LessonPlayer";
import { LessonTabs } from "@/components/student/LessonTabs";
import { LessonHeader } from "@/components/student/LessonHeader";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent();
  const lesson = await getAccessibleLesson(user.id, id);
  if (!lesson) notFound();
  const [lp, vp] = await Promise.all([
    prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: id } } }),
    prisma.vocabularyProgress.findMany({ where: { userId: user.id, vocabularyId: { in: lesson.vocabulary.map((v) => v.id) }, difficult: true }, select: { vocabularyId: true } }),
  ]);
  const difficult = new Set(vp.map((v) => v.vocabularyId));

  return (
    <div>
      <LessonHeader lesson={lesson} />
      <LessonTabs lessonId={id} active="learn" />
      {lesson.vocabulary.length === 0 ? (
        <p className="text-center text-slate-500">This lesson has no words yet.</p>
      ) : (
        <LessonPlayer
          lessonId={id}
          completed={lp?.status === "COMPLETED"}
          initialSeen={lp?.seenVocabularyIds ?? []}
          dailyTestId={lesson.tests[0]?.id ?? null}
          words={lesson.vocabulary.map((v) => ({
            id: v.id, german: v.german, english: v.english, article: v.article, plural: v.plural, partOfSpeech: v.partOfSpeech,
            ipa: v.ipa, phonetic: v.phonetic, audioUrl: v.audioUrl, difficult: difficult.has(v.id),
            sentences: v.sentences.map((s) => ({ id: s.id, german: s.german, english: s.english, audioUrl: s.audioUrl })),
          }))}
        />
      )}
    </div>
  );
}
