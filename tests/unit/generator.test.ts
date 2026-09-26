import { describe, expect, it } from "vitest";
import { generateQuestions, applicableTypes } from "@/lib/tests/generator";
import { seededRng } from "@/lib/tests/rng";
import { gapSentence } from "@/lib/tests/format";
import type { QuizVocab } from "@/lib/tests/types";

const words: QuizVocab[] = [
  { id: "1", german: "Hund", english: "dog", article: "DER", sentences: [{ german: "Der Hund bellt.", english: "The dog barks." }] },
  { id: "2", german: "Katze", english: "cat", article: "DIE", sentences: [] },
  { id: "3", german: "Haus", english: "house", article: "DAS", sentences: [] },
  { id: "4", german: "laufen", english: "to run", article: null, sentences: [{ german: "Wir laufen schnell.", english: "We run fast." }] },
  { id: "5", german: "gut", english: "good", article: null, sentences: [] },
];

describe("question generation", () => {
  it("produces the requested number of questions", () => {
    const qs = generateQuestions({ targets: words, count: 8, types: ["DE_TO_EN"], randomize: true, rng: seededRng(1) });
    expect(qs).toHaveLength(8);
  });

  it("covers every target word before repeating", () => {
    const qs = generateQuestions({ targets: words, count: 5, types: ["DE_TO_EN", "EN_TO_DE"], randomize: true, rng: seededRng(2) });
    expect(new Set(qs.map((q) => q.vocabularyId)).size).toBe(5);
  });

  it("multiple choice options contain the answer once, with unique options", () => {
    const qs = generateQuestions({ targets: words, count: 10, types: ["DE_TO_EN", "EN_TO_DE", "LISTENING"], randomize: true, rng: seededRng(3) });
    for (const q of qs) {
      expect(q.options.filter((o) => o === q.correctAnswer)).toHaveLength(1);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options.length).toBe(4);
    }
  });

  it("only asks article questions for nouns with an article", () => {
    expect(applicableTypes(words[3], ["ARTICLE"])).toEqual([]);
    const qs = generateQuestions({ targets: words, count: 10, types: ["ARTICLE"], randomize: false, rng: seededRng(4) });
    for (const q of qs) {
      if (q.questionType === "ARTICLE") expect(["der", "die", "das"]).toContain(q.correctAnswer);
      else expect(q.questionType).toBe("DE_TO_EN"); // fallback when no type applies
    }
  });

  it("builds sentence questions with a gap", () => {
    const qs = generateQuestions({ targets: [words[0]], distractorPool: words, count: 1, types: ["SENTENCE"], randomize: false, rng: seededRng(5) });
    expect(qs[0].promptData?.sentence).toBe("Der _____ bellt.");
    expect(qs[0].correctAnswer).toBe("Hund");
  });

  it("is deterministic for a given seed", () => {
    const a = generateQuestions({ targets: words, count: 6, types: ["DE_TO_EN", "SPELLING"], randomize: true, rng: seededRng(9) });
    const b = generateQuestions({ targets: words, count: 6, types: ["DE_TO_EN", "SPELLING"], randomize: true, rng: seededRng(9) });
    expect(a).toEqual(b);
  });

  it("gapSentence matches whole words only", () => {
    expect(gapSentence("Das Haustier schläft.", "Haus")).toBeNull();
    expect(gapSentence("Ich gehe nach Hause.", "Hause")).toBe("Ich gehe nach _____.");
  });
});
