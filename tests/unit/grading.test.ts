import { describe, expect, it } from "vitest";
import { gradeAnswer, normalizeGerman, scoreAttempt } from "@/lib/tests/grading";

describe("grading", () => {
  it("accepts spelling with umlaut folding, case and article differences", () => {
    const q = { questionType: "SPELLING" as const, correctAnswer: "Mädchen" };
    expect(gradeAnswer(q, "Mädchen")).toBe(true);
    expect(gradeAnswer(q, "maedchen")).toBe(true);
    expect(gradeAnswer(q, "das Mädchen")).toBe(true);
    expect(gradeAnswer(q, "Madchen")).toBe(false);
    expect(normalizeGerman("  Straße ")).toBe("strasse");
  });

  it("multiple choice requires the exact option", () => {
    const q = { questionType: "DE_TO_EN" as const, correctAnswer: "dog" };
    expect(gradeAnswer(q, "dog")).toBe(true);
    expect(gradeAnswer(q, "cat")).toBe(false);
    expect(gradeAnswer(q, "")).toBe(false);
  });

  it("never grades pronunciation", () => {
    expect(gradeAnswer({ questionType: "PRONUNCIATION", correctAnswer: "Hund" }, "Hund")).toBeNull();
  });

  it("scores only gradable answers", () => {
    const s = scoreAttempt([true, false, true, null], 60);
    expect(s).toMatchObject({ score: 2, total: 3, correctCount: 2, incorrectCount: 1, percentage: 66.7, passed: true });
    expect(scoreAttempt([null], 50).passed).toBe(false);
  });
});
