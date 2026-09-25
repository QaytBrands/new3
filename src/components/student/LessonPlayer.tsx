"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Article } from "@prisma/client";
import { AudioButton } from "@/components/ui/AudioButton";
import { articleColor } from "@/components/ui/ArticleBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { completeLesson, markWordSeen, setDifficult } from "@/server/student-actions";

export type PlayerWord = {
  id: string;
  german: string;
  english: string;
  article: Article | null;
  plural: string | null;
  partOfSpeech: string | null;
  ipa: string | null;
  phonetic: string | null;
  nativeAudioUrl: string | null;
  sentences: { id: string; german: string; english: string; nativeAudioUrl: string | null }[];
  difficult: boolean;
};

export function LessonPlayer({
  lessonId,
  words,
  initialSeen,
  completed,
  dailyTestId,
}: {
  lessonId: string;
  words: PlayerWord[];
  initialSeen: string[];
  completed: boolean;
  dailyTestId: string | null;
}) {
  const router = useRouter();
  const firstUnseen = words.findIndex((w) => !initialSeen.includes(w.id));
  const [index, setIndex] = useState(completed || firstUnseen < 0 ? 0 : firstUnseen);
  const [seen, setSeen] = useState(() => new Set(initialSeen));
  const [difficult, setDiff] = useState(() => new Set(words.filter((w) => w.difficult).map((w) => w.id)));
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const word = words[index];

  function markSeen(id: string) {
    if (seen.has(id)) return;
    setSeen((s) => new Set(s).add(id));
    markWordSeen(lessonId, id).catch(() => {});
  }

  function go(delta: number) {
    markSeen(word.id);
    setRevealed(false);
    setIndex((i) => Math.max(0, Math.min(words.length - 1, i + delta)));
  }

  function finish() {
    markSeen(word.id);
    startTransition(async () => {
      const res = await completeLesson(lessonId);
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  function toggleDifficult() {
    const next = !difficult.has(word.id);
    setDiff((s) => {
      const n = new Set(s);
      if (next) n.add(word.id);
      else n.delete(word.id);
      return n;
    });
    setDifficult(word.id, next).catch(() => {});
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <div className="mb-3 text-5xl">🎉</div>
        <h2 className="text-2xl font-bold">Lesson complete!</h2>
        <p className="mt-2 text-slate-500">You went through all {words.length} words.</p>
        <div className="mt-6 flex flex-col gap-3">
          {dailyTestId && <Link href={`/tests/${dailyTestId}`} className="btn-primary btn-lg">Take the daily test</Link>}
          <Link href={`/lessons/${lessonId}/practice`} className="btn-secondary">Practise sentences</Link>
          <Link href="/dashboard" className="text-sm text-slate-500 underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const isLast = index === words.length - 1;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar value={(seen.size / words.length) * 100} />
        <span className="shrink-0 text-sm tabular-nums text-slate-500">{index + 1} / {words.length}</span>
      </div>

      <article className="card overflow-hidden" aria-live="polite">
        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            {word.partOfSpeech && <span>{word.partOfSpeech}</span>}
          </div>
          <h2 className="text-4xl font-bold leading-tight sm:text-5xl">
            {word.article && <span className={clsx("mr-2", articleColor(word.article))}>{word.article.toLowerCase()}</span>}
            {word.german}
          </h2>
          {word.plural && <p className="mt-2 text-slate-500">Plural: <span className="font-medium text-slate-700">die {word.plural}</span></p>}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-slate-600">
            {word.ipa && <span className="font-mono text-base" title="IPA">/{word.ipa}/</span>}
            {word.phonetic && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-sm font-semibold text-amber-800" title="Say it like">🗣 {word.phonetic}</span>}
          </div>
          <div className="mt-5">
            <AudioButton text={word.article ? `${word.article.toLowerCase()} ${word.german}` : word.german} nativeAudioUrl={word.nativeAudioUrl} size="lg" showSource />
          </div>

          <div className="mt-6 w-full">
            {revealed || seen.has(word.id) ? (
              <p className="text-2xl font-semibold text-brand-700">{word.english}</p>
            ) : (
              <button type="button" onClick={() => setRevealed(true)} className="btn-secondary w-full">Show meaning</button>
            )}
          </div>
        </div>

        {word.sentences.length > 0 && (
          <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            {word.sentences.map((s) => (
              <div key={s.id} className="flex items-start gap-3">
                <AudioButton text={s.german} nativeAudioUrl={s.nativeAudioUrl} size="sm" label={`Play sentence: ${s.german}`} />
                <div>
                  <p className="text-lg font-medium">{s.german}</p>
                  <p className="text-sm text-slate-500">{s.english}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <button type="button" onClick={toggleDifficult} className={clsx("rounded-full px-3 py-1.5 text-sm font-medium", difficult.has(word.id) ? "bg-amber-100 text-amber-800" : "text-slate-500 hover:bg-slate-100")} aria-pressed={difficult.has(word.id)}>
            {difficult.has(word.id) ? "★ Marked difficult" : "☆ Mark difficult"}
          </button>
          <Link href={`/lessons/${lessonId}/pronounce?word=${word.id}`} className="text-sm font-medium text-brand-600">🎙 Practise saying it</Link>
        </div>
      </article>

      {error && <p className="mt-3 text-center text-sm text-rose-600">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => go(-1)} disabled={index === 0} className="btn-secondary btn-lg">← Back</button>
        {isLast ? (
          <button type="button" onClick={finish} disabled={pending || words.some((w) => w.id !== word.id && !seen.has(w.id))} className="btn-primary btn-lg">
            {pending ? "Saving…" : completed ? "Done" : "Finish lesson"}
          </button>
        ) : (
          <button type="button" onClick={() => go(1)} className="btn-primary btn-lg">Next →</button>
        )}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label="Jump to word">
        {words.map((w, i) => (
          <button
            key={w.id}
            type="button"
            onClick={() => { markSeen(word.id); setRevealed(false); setIndex(i); }}
            className={clsx("h-2.5 w-2.5 rounded-full", i === index ? "bg-brand-600" : seen.has(w.id) ? "bg-brand-200" : "bg-slate-300")}
            aria-label={`Word ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
