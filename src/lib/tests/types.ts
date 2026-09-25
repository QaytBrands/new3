import type { Article, QuestionType } from "@prisma/client";

export type QuizVocab = {
  id: string;
  german: string;
  english: string;
  article: Article | null;
  plural?: string | null;
  ipa?: string | null;
  phonetic?: string | null;
  nativeAudioUrl?: string | null;
  sentences: { german: string; english: string }[];
};

export type PromptData = {
  sentence?: string;
  audioText?: string;
  nativeAudioUrl?: string | null;
  /** @deprecated key used by attempts created before native audio was introduced */
  audioUrl?: string | null;
  ipa?: string | null;
  phonetic?: string | null;
  hint?: string;
};

export type GeneratedQuestion = {
  vocabularyId: string;
  questionType: QuestionType;
  prompt: string;
  promptData: PromptData | null;
  options: string[];
  correctAnswer: string;
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  DE_TO_EN: "German → English",
  EN_TO_DE: "English → German",
  ARTICLE: "Article selection",
  SPELLING: "German spelling",
  SENTENCE: "Sentence selection",
  LISTENING: "Listening comprehension",
  PRONUNCIATION: "Pronunciation recording",
};
