import type { Test } from "@prisma/client";
import { QUESTION_TYPE_LABELS } from "@/lib/tests/types";
import { Checkbox, Field } from "./ActionForm";

export function TestFields({ t, defaults }: { t?: Test; defaults: { title: string; questionCount: number; passingScore: number } }) {
  const types = t?.questionTypes ?? ["DE_TO_EN", "EN_TO_DE", "ARTICLE", "SPELLING", "SENTENCE", "LISTENING"];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Title" className="sm:col-span-2"><input className="input" name="title" defaultValue={t?.title ?? defaults.title} required /></Field>
        <Field label="Questions"><input className="input" type="number" min={1} max={100} name="questionCount" defaultValue={t?.questionCount ?? defaults.questionCount} /></Field>
        <Field label="Passing score %"><input className="input" type="number" min={0} max={100} name="passingScore" defaultValue={t?.passingScore ?? defaults.passingScore} /></Field>
        <Field label="Time limit (minutes)" hint="Blank = no limit"><input className="input" type="number" min={1} name="timeLimitMin" defaultValue={t?.timeLimitSec ? Math.round(t.timeLimitSec / 60) : ""} /></Field>
      </div>
      <fieldset>
        <legend className="label">Question types</legend>
        <div className="grid gap-1 sm:grid-cols-3">
          {Object.entries(QUESTION_TYPE_LABELS).map(([k, label]) => (
            <Checkbox key={k} name="questionTypes" value={k} label={label + (k === "PRONUNCIATION" ? " (not scored)" : "")} defaultChecked={types.includes(k as never)} />
          ))}
        </div>
      </fieldset>
      <div className="flex gap-6">
        <Checkbox name="randomize" label="Randomize questions" defaultChecked={t?.randomize ?? true} />
        <Checkbox name="published" label="Published" defaultChecked={t?.published ?? true} />
      </div>
    </>
  );
}
