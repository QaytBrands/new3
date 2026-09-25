"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Article } from "@prisma/client";
import { AudioButton } from "@/components/ui/AudioButton";
import { articleColor } from "@/components/ui/ArticleBadge";
import { Recorder } from "./Recorder";

type Word = { id: string; german: string; english: string; article: Article | null; ipa: string | null; phonetic: string | null; audioUrl: string | null };

export function PronunciationPractice({ words, initialId }: { words: Word[]; initialId?: string }) {
  const start = Math.max(0, words.findIndex((w) => w.id === initialId));
  const [i, setI] = useState(start);
  const w = words[i];
  const spoken = w.article ? `${w.article.toLowerCase()} ${w.german}` : w.german;
  return (
    <div className="mx-auto max-w-xl">
      <div className="card p-6 text-center sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{i + 1} / {words.length}</p>
        <h2 className="mt-2 text-4xl font-bold sm:text-5xl">
          {w.article && <span className={clsx("mr-2", articleColor(w.article))}>{w.article.toLowerCase()}</span>}
          {w.german}
        </h2>
        <p className="mt-1 text-slate-500">{w.english}</p>
        <dl className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3 text-left">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="label">IPA</dt>
            <dd className="font-mono text-lg">{w.ipa ? `/${w.ipa}/` : "—"}</dd>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <dt className="label">Say it like</dt>
            <dd className="text-lg font-semibold text-amber-900">{w.phonetic ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-slate-600">1. Listen</p>
          <AudioButton text={spoken} audioUrl={w.audioUrl} size="lg" showSource />
        </div>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="mb-2 text-sm font-medium text-slate-600">2. Record yourself</p>
          <Recorder key={w.id} vocabularyId={w.id} expected={w.german} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button className="btn-secondary btn-lg" disabled={i === 0} onClick={() => setI(i - 1)}>← Previous</button>
        <button className="btn-primary btn-lg" disabled={i === words.length - 1} onClick={() => setI(i + 1)}>Next word →</button>
      </div>
    </div>
  );
}
