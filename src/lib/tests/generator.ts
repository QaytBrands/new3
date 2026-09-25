import type { QuestionType } from "@prisma/client";
import { gapSentence, withArticle, articleText } from "./format";
import { shuffle, type Rng } from "./rng";
import type { GeneratedQuestion, QuizVocab } from "./types";

const OPTION_COUNT = 4;

export function applicableTypes(v: QuizVocab, allowed: readonly QuestionType[]): QuestionType[] {
  return allowed.filter((t) => {
    if (t === "ARTICLE") return !!v.article;
    if (t === "SENTENCE") return v.sentences.some((s) => gapSentence(s.german, v.german) !== null);
    return true;
  });
}

function pickDistractors(
  correct: string,
  candidates: string[],
  rng: Rng,
  count = OPTION_COUNT - 1,
): string[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const seen = new Set([norm(correct)]);
  const out: string[] = [];
  for (const c of shuffle(candidates, rng)) {
    if (out.length >= count) break;
    if (seen.has(norm(c))) continue;
    seen.add(norm(c));
    out.push(c);
  }
  return out;
}

function mc(correct: string, candidates: string[], rng: Rng): string[] {
  return shuffle([correct, ...pickDistractors(correct, candidates, rng)], rng);
}

export function buildQuestion(
  v: QuizVocab,
  type: QuestionType,
  pool: QuizVocab[],
  rng: Rng,
): GeneratedQuestion {
  const others = pool.filter((p) => p.id !== v.id);
  const base = { vocabularyId: v.id, questionType: type };
  switch (type) {
    case "DE_TO_EN":
      return {
        ...base,
        prompt: withArticle(v),
        promptData: null,
        options: mc(v.english, others.map((o) => o.english), rng),
        correctAnswer: v.english,
      };
    case "EN_TO_DE": {
      const correct = withArticle(v);
      return {
        ...base,
        prompt: v.english,
        promptData: null,
        options: mc(correct, others.map(withArticle), rng),
        correctAnswer: correct,
      };
    }
    case "ARTICLE":
      return {
        ...base,
        prompt: v.german,
        promptData: { hint: v.english },
        options: ["der", "die", "das"],
        correctAnswer: articleText(v.article)!,
      };
    case "SPELLING":
      return {
        ...base,
        prompt: v.english,
        promptData: v.article ? { hint: `Noun — include only the word, e.g. without "${articleText(v.article)}"` } : null,
        options: [],
        correctAnswer: v.german,
      };
    case "SENTENCE": {
      const s = shuffle(
        v.sentences.filter((x) => gapSentence(x.german, v.german) !== null),
        rng,
      )[0];
      return {
        ...base,
        prompt: s.english,
        promptData: { sentence: gapSentence(s.german, v.german)! },
        options: mc(v.german, others.map((o) => o.german), rng),
        correctAnswer: v.german,
      };
    }
    case "LISTENING":
      return {
        ...base,
        prompt: "Listen and choose the meaning",
        promptData: { audioText: withArticle(v), nativeAudioUrl: v.nativeAudioUrl ?? null },
        options: mc(v.english, others.map((o) => o.english), rng),
        correctAnswer: v.english,
      };
    case "PRONUNCIATION":
      return {
        ...base,
        prompt: withArticle(v),
        promptData: { ipa: v.ipa ?? null, phonetic: v.phonetic ?? null, nativeAudioUrl: v.nativeAudioUrl ?? null },
        options: [],
        correctAnswer: v.german,
      };
  }
}

export type GenerateOptions = {
  /** Words the test should primarily cover */
  targets: QuizVocab[];
  /** Additional words used only as multiple-choice distractors */
  distractorPool?: QuizVocab[];
  count: number;
  types: readonly QuestionType[];
  randomize: boolean;
  rng: Rng;
};

/**
 * Builds `count` questions. Each target word is used once before any word repeats, and a
 * repeated word gets a different question type where possible.
 */
export function generateQuestions(opts: GenerateOptions): GeneratedQuestion[] {
  const { targets, count, rng, randomize } = opts;
  if (targets.length === 0 || count <= 0) return [];
  const types = opts.types.length ? opts.types : (["DE_TO_EN"] as QuestionType[]);
  const pool = dedupeById([...targets, ...(opts.distractorPool ?? [])]);
  const order = randomize ? shuffle(targets, rng) : [...targets];
  const usedTypes = new Map<string, Set<QuestionType>>();
  const questions: GeneratedQuestion[] = [];
  let typeCursor = 0;

  for (let i = 0; i < count; i++) {
    const v = order[i % order.length];
    let candidates = applicableTypes(v, types);
    if (candidates.length === 0) candidates = ["DE_TO_EN"];
    const used = usedTypes.get(v.id) ?? new Set();
    const fresh = candidates.filter((t) => !used.has(t));
    const choices = fresh.length ? fresh : candidates;
    const type = randomize
      ? choices[Math.floor(rng() * choices.length)]
      : choices[typeCursor++ % choices.length];
    used.add(type);
    usedTypes.set(v.id, used);
    questions.push(buildQuestion(v, type, pool, rng));
  }
  return questions;
}

function dedupeById(items: QuizVocab[]): QuizVocab[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
