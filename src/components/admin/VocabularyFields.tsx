import type { Vocabulary } from "@prisma/client";
import { Field } from "./ActionForm";

export function VocabularyFields({ v }: { v?: Partial<Vocabulary> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="German *"><input className="input" name="german" defaultValue={v?.german} required /></Field>
      <Field label="English *"><input className="input" name="english" defaultValue={v?.english} required /></Field>
      <Field label="Article">
        <select className="input" name="article" defaultValue={v?.article?.toLowerCase() ?? ""}>
          <option value="">—</option>
          <option value="der">der</option>
          <option value="die">die</option>
          <option value="das">das</option>
        </select>
      </Field>
      <Field label="Plural"><input className="input" name="plural" defaultValue={v?.plural ?? ""} placeholder="e.g. Hunde" /></Field>
      <Field label="Part of speech"><input className="input" name="partOfSpeech" defaultValue={v?.partOfSpeech ?? ""} placeholder="noun, verb…" /></Field>
      <Field label="IPA"><input className="input font-mono" name="ipa" defaultValue={v?.ipa ?? ""} placeholder="hʊnt" /></Field>
      <Field label="Learner pronunciation"><input className="input" name="phonetic" defaultValue={v?.phonetic ?? ""} placeholder="hoont" /></Field>
      <Field label="Difficulty (1–5)"><input className="input" type="number" min={1} max={5} name="difficulty" defaultValue={v?.difficulty ?? 1} /></Field>
      <Field label="Native audio URL" className="sm:col-span-2" hint="Native-speaker recording (https://…). If empty, students hear a labelled synthesized voice."><input className="input" name="nativeAudioUrl" defaultValue={v?.nativeAudioUrl ?? ""} placeholder="https://… (optional)" /></Field>
      <Field label="Tags" className="sm:col-span-2" hint="Separate with commas"><input className="input" name="tags" defaultValue={v?.tags?.join(", ") ?? ""} /></Field>
    </div>
  );
}
