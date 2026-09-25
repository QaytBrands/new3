import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { getAccessibleLesson } from "@/server/student-data";
import { PronunciationPractice } from "@/components/student/PronunciationPractice";
import { LessonTabs } from "@/components/student/LessonTabs";
import { LessonHeader } from "@/components/student/LessonHeader";

export default async function PronouncePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ word?: string }> }) {
  const { id } = await params;
  const { word } = await searchParams;
  const user = await requireStudent();
  const lesson = await getAccessibleLesson(user.id, id);
  if (!lesson) notFound();
  return (
    <div>
      <LessonHeader lesson={lesson} />
      <LessonTabs lessonId={id} active="pronounce" />
      {lesson.vocabulary.length ? (
        <PronunciationPractice
          initialId={word}
          words={lesson.vocabulary.map((v) => ({ id: v.id, german: v.german, english: v.english, article: v.article, ipa: v.ipa, phonetic: v.phonetic, nativeAudioUrl: v.nativeAudioUrl }))}
        />
      ) : (
        <p className="text-center text-slate-500">This lesson has no words yet.</p>
      )}
    </div>
  );
}
