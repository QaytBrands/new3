import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { ActionForm } from "@/components/admin/ActionForm";
import { TestFields } from "@/components/admin/TestFields";
import { saveTest } from "@/server/admin/tests";

export default async function NewTest({ searchParams }: { searchParams: Promise<{ lessonId?: string; chapterId?: string }> }) {
  await requirePagePermission("MANAGE_TESTS");
  const { lessonId, chapterId } = await searchParams;
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const lesson = lessonId ? await prisma.lesson.findUnique({ where: { id: lessonId }, include: { chapter: true, _count: { select: { vocabulary: true } } } }) : null;
  const chapter = chapterId ? await prisma.chapter.findUnique({ where: { id: chapterId } }) : null;
  if (!lesson && !chapter) notFound();
  const defaults = lesson
    ? { title: `${lesson.chapter.title} – Day ${lesson.dayNumber} test`, questionCount: Math.max(5, lesson._count.vocabulary), passingScore: settings?.defaultDailyPassScore ?? 70 }
    : { title: `${chapter!.title} – Weekly test`, questionCount: 20, passingScore: settings?.defaultWeeklyPassScore ?? 75 };
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">New {lesson ? "daily" : "weekly"} test</h1>
      <section className="card p-4">
        <ActionForm action={saveTest} submitLabel="Create test">
          <input type="hidden" name="kind" value={lesson ? "DAILY" : "WEEKLY"} />
          {lesson && <input type="hidden" name="lessonId" value={lesson.id} />}
          {chapter && <input type="hidden" name="chapterId" value={chapter.id} />}
          <TestFields defaults={defaults} />
        </ActionForm>
      </section>
    </div>
  );
}
