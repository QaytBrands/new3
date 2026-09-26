"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { AudioButton } from "@/components/ui/AudioButton";
import { gapSentence } from "@/lib/tests/format";
import { seededRng, shuffle } from "@/lib/tests/rng";

type Item = { id: string; german: string; english: string; sentence: { german: string; english: string } };

export function SentencePractice({ items, allWords }: { items: Item[]; allWords: string[] }) {
  const questions = useMemo(() => {
    const rng = seededRng(items.length * 7919);
    return shuffle(items, rng).map((it) => ({
      ...it,
      gapped: gapSentence(it.sentence.german, it.german)!,
      options: shuffle([it.german, ...shuffle(allWords.filter((w) => w !== it.german), rng).slice(0, 3)], rng),
    }));
  }, [items, allWords]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);

  if (questions.length === 0) return <p className="text-slate-500">No example sentences in this lesson yet.</p>;
  if (i >= questions.length) {
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl">✅</p>
        <h2 className="mt-2 text-xl font-bold">{correct} / {questions.length} correct</h2>
        <button className="btn-primary mt-4" onClick={() => { setI(0); setCorrect(0); setPicked(null); }}>Practise again</button>
      </div>
    );
  }
  const q = questions[i];
  return (
    <div className="card p-6">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">Complete the sentence · {i + 1}/{questions.length}</p>
      <p className="text-2xl font-semibold leading-snug">{picked ? q.sentence.german : q.gapped}</p>
      <p className="mt-1 text-slate-500">{q.sentence.english}</p>
      {picked && <div className="mt-3"><AudioButton text={q.sentence.german} size="sm" /></div>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {q.options.map((o) => (
          <button
            key={o}
            disabled={!!picked}
            onClick={() => { setPicked(o); if (o === q.german) setCorrect((c) => c + 1); }}
            className={clsx(
              "rounded-xl border-2 px-4 py-3 text-lg font-medium",
              !picked && "border-slate-200 hover:bg-slate-50",
              picked && o === q.german && "border-emerald-500 bg-emerald-50 text-emerald-800",
              picked && o === picked && o !== q.german && "border-rose-400 bg-rose-50 text-rose-700",
              picked && o !== picked && o !== q.german && "border-slate-200 opacity-50",
            )}
          >
            {o}
          </button>
        ))}
      </div>
      {picked && (
        <button className="btn-primary btn-lg mt-5 w-full" onClick={() => { setI(i + 1); setPicked(null); }}>Continue →</button>
      )}
    </div>
  );
}
