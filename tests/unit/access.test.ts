import { describe, expect, it } from "vitest";
import { buildAccessSet, canAccessChapter, canAccessLesson, visibleLevelIds } from "@/lib/access";

const lesson = { id: "les1", chapterId: "ch1", levelId: "A1" };

describe("access resolution", () => {
  it("grants nothing without unlocks", () => {
    const a = buildAccessSet([]);
    expect(canAccessLesson(a, lesson)).toBe(false);
    expect(canAccessChapter(a, { id: "ch1", levelId: "A1" })).toBe(false);
  });

  it("level unlock grants all chapters and lessons in that level only", () => {
    const a = buildAccessSet([{ scope: "LEVEL", levelId: "A1", chapterId: null, lessonId: null }]);
    expect(canAccessLesson(a, lesson)).toBe(true);
    expect(canAccessLesson(a, { id: "x", chapterId: "chB", levelId: "A2" })).toBe(false);
  });

  it("chapter unlock grants its lessons but not sibling chapters", () => {
    const a = buildAccessSet([{ scope: "CHAPTER", levelId: null, chapterId: "ch1", lessonId: null }]);
    expect(canAccessLesson(a, lesson)).toBe(true);
    expect(canAccessLesson(a, { id: "les9", chapterId: "ch2", levelId: "A1" })).toBe(false);
  });

  it("lesson unlock grants only that lesson", () => {
    const a = buildAccessSet([{ scope: "LESSON", levelId: null, chapterId: null, lessonId: "les1" }]);
    expect(canAccessLesson(a, lesson)).toBe(true);
    expect(canAccessLesson(a, { ...lesson, id: "les2" })).toBe(false);
    expect(canAccessChapter(a, { id: "ch1", levelId: "A1" })).toBe(false);
  });

  it("surfaces levels that contain partially unlocked content", () => {
    const a = buildAccessSet([{ scope: "LESSON", levelId: null, chapterId: null, lessonId: "les1" }]);
    expect([...visibleLevelIds(a, new Map(), new Map([["les1", "A1"]]))]).toEqual(["A1"]);
  });
});
