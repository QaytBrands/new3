import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { getAccessibleLesson } from "@/server/student-data";
import { gapSentence } from "@/lib/tests/format";
import { SentencePractice } from "@/components/student/SentencePractice";
import { LessonTabs } from "@/components/student/LessonTabs";
import { LessonHeader } from "@/components/student/LessonHeader";

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent();
  const lesson = await getAccessibleLesson(user.id, id);
  if (!lesson) notFound();
  const items = lesson.vocabulary.flatMap((v) => {
    const s = v.sentences.find((x) => gapSentence(x.german, v.german) !== null);
    return s ? [{ id: v.id, german: v.german, english: v.english, sentence: { german: s.german, english: s.english } }] : [];
  });
  return (
    <div className="mx-auto max-w-xl">
      <LessonHeader lesson={lesson} />
      <LessonTabs lessonId={id} active="practice" />
      <SentencePractice items={items} allWords={lesson.vocabulary.map((v) => v.german)} />
    </div>
  );
}
