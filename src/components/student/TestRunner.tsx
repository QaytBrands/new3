"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import type { QuestionType } from "@prisma/client";
import { AudioButton } from "@/components/ui/AudioButton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Recorder } from "./Recorder";
import { submitTest } from "@/server/test-actions";
import type { PromptData } from "@/lib/tests/types";

export type RunnerQuestion = {
  position: number;
  questionType: QuestionType;
  prompt: string;
  promptData: PromptData | null;
  options: string[];
  vocabularyId: string;
};

const INSTRUCTIONS: Record<QuestionType, string> = {
  DE_TO_EN: "What does this mean?",
  EN_TO_DE: "Choose the German word",
  ARTICLE: "Choose the correct article",
  SPELLING: "Type the German word",
  SENTENCE: "Complete the sentence",
  LISTENING: "Listen and choose the meaning",
  PRONUNCIATION: "Say this word out loud",
};

const UMLAUTS = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"];

export function TestRunner({
  attemptId,
  title,
  questions,
  timeLimitSec,
  startedAt,
}: {
  attemptId: string;
  title: string;
  questions: RunnerQuestion[];
  timeLimitSec: number | null;
  startedAt: string;
}) {
  const storageKey = `attempt:${attemptId}`;
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [index, setIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const submitted = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      // Restoring browser-only state after hydration; a lazy initializer would mismatch the server render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setAnswers(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {}
  }, [answers, storageKey]);

  const deadline = useMemo(() => (timeLimitSec ? new Date(startedAt).getTime() + timeLimitSec * 1000 : null), [startedAt, timeLimitSec]);
  const [remaining, setRemaining] = useState<number | null>(() => (deadline ? Math.max(0, deadline - Date.now()) : null));

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    startTransition(async () => {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      await submitTest(attemptId, answers);
    });
  }, [answers, attemptId, storageKey]);

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0) submit();
    }, 500);
    return () => clearInterval(t);
  }, [deadline, submit]);

  const q = questions[index];
  const answered = Object.keys(answers).length;
  const setAnswer = (v: string) => setAnswers((a) => ({ ...a, [q.position]: v }));
  const isLast = index === questions.length - 1;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span className="font-medium text-slate-700">{title}</span>
        {remaining !== null && (
          <span className={clsx("tabular-nums font-semibold", remaining < 60000 ? "text-rose-600" : "text-slate-600")} aria-live="polite">
            ⏱ {Math.floor(remaining / 60000)}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar value={((index + 1) / questions.length) * 100} />
        <span className="shrink-0 text-sm tabular-nums text-slate-500">{index + 1} / {questions.length}</span>
      </div>

      <section className="card p-6" aria-labelledby="q-prompt">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">{INSTRUCTIONS[q.questionType]}</p>

        {q.questionType === "LISTENING" ? (
          <div className="my-6 flex justify-center">
            <AudioButton text={q.promptData?.audioText ?? ""} nativeAudioUrl={q.promptData?.nativeAudioUrl ?? q.promptData?.audioUrl} size="lg" label="Play the word" />
          </div>
        ) : q.questionType === "SENTENCE" ? (
          <div id="q-prompt" className="my-4">
            <p className="text-2xl font-semibold leading-snug">{q.promptData?.sentence}</p>
            <p className="mt-2 text-slate-500">{q.prompt}</p>
          </div>
        ) : (
          <h2 id="q-prompt" className="my-4 text-center text-3xl font-bold sm:text-4xl">{q.prompt}</h2>
        )}
        {q.questionType === "ARTICLE" && q.promptData?.hint && <p className="-mt-2 mb-4 text-center text-slate-500">({q.promptData.hint})</p>}

        {q.options.length > 0 && (
          <div className={clsx("grid gap-3", q.questionType === "ARTICLE" ? "grid-cols-3" : "grid-cols-1")}>
            {q.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setAnswer(opt)}
                aria-pressed={answers[q.position] === opt}
                className={clsx(
                  "rounded-xl border-2 px-4 py-3.5 text-left text-lg font-medium transition",
                  q.questionType === "ARTICLE" && "text-center",
                  answers[q.position] === opt ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {q.questionType === "SPELLING" && (
          <div>
            <input
              ref={inputRef}
              className="input py-3 text-center text-2xl"
              value={answers[q.position] ?? ""}
              onChange={(e) => setAnswer(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Your answer"
              placeholder="Type in German"
              onKeyDown={(e) => e.key === "Enter" && !isLast && setIndex(index + 1)}
            />
            {q.promptData?.hint && <p className="mt-2 text-center text-xs text-slate-400">{q.promptData.hint}</p>}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {UMLAUTS.map((c) => (
                <button key={c} type="button" className="h-10 w-10 rounded-lg border border-slate-200 bg-white text-lg" onClick={() => { setAnswer((answers[q.position] ?? "") + c); inputRef.current?.focus(); }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {q.questionType === "PRONUNCIATION" && (
          <div className="text-center">
            {(q.promptData?.ipa || q.promptData?.phonetic) && (
              <p className="mb-3 text-slate-600">
                {q.promptData?.ipa && <span className="mr-3 font-mono">/{q.promptData.ipa}/</span>}
                {q.promptData?.phonetic && <span className="font-semibold text-amber-800">{q.promptData.phonetic}</span>}
              </p>
            )}
            <AudioButton text={q.prompt} nativeAudioUrl={q.promptData?.nativeAudioUrl ?? q.promptData?.audioUrl} showSource />
            <div className="mt-4">
              <Recorder key={q.position} vocabularyId={q.vocabularyId} expected={q.prompt} compact onSaved={(id) => setAnswer(id)} />
            </div>
            <p className="mt-2 text-xs text-slate-400">Pronunciation questions are recorded for your teacher and don’t affect your score.</p>
          </div>
        )}
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" className="btn-secondary btn-lg" disabled={index === 0} onClick={() => setIndex(index - 1)}>← Back</button>
        {isLast ? (
          <button type="button" className="btn-primary btn-lg" disabled={pending} onClick={() => (answered < questions.length ? setConfirming(true) : submit())}>
            {pending ? "Submitting…" : "Submit"}
          </button>
        ) : (
          <button type="button" className="btn-primary btn-lg" onClick={() => setIndex(index + 1)}>Next →</button>
        )}
      </div>

      {confirming && !pending && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">{questions.length - answered} question(s) unanswered. Submit anyway?</p>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={submit}>Submit</button>
            <button className="btn-secondary" onClick={() => setConfirming(false)}>Keep going</button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label="Questions">
        {questions.map((qq, i) => (
          <button
            key={qq.position}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Question ${i + 1}${answers[qq.position] ? " (answered)" : ""}`}
            className={clsx("h-7 w-7 rounded-full text-xs font-semibold", i === index ? "bg-brand-600 text-white" : answers[qq.position] ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-500")}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
