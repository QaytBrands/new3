import { describe, expect, it } from "vitest";
import { applyReview, computeMastery } from "@/lib/srs";

const fresh = { timesSeen: 0, timesCorrect: 0, timesIncorrect: 0, easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

describe("srs", () => {
  it("increases interval on consecutive correct answers", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const r1 = applyReview(fresh, true, now);
    const r2 = applyReview(r1, true, now);
    const r3 = applyReview(r2, true, now);
    expect([r1.intervalDays, r2.intervalDays]).toEqual([1, 3]);
    expect(r3.intervalDays).toBeGreaterThan(3);
    expect(r3.mastery).toBeGreaterThan(r1.mastery);
  });

  it("schedules correct answers for local midnight in the student's time zone", () => {
    // 2026-03-01 20:00 UTC is already 2 March 01:30 in Kolkata.
    const now = new Date("2026-03-01T20:00:00Z");
    const kolkata = applyReview(fresh, true, now, "Asia/Kolkata");
    expect(kolkata.nextReviewAt.toISOString()).toBe("2026-03-02T18:30:00.000Z"); // 3 March 00:00 IST
    const utc = applyReview(fresh, true, now, "UTC");
    expect(utc.nextReviewAt.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });

  it("resets on an incorrect answer and schedules immediate review", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const r = applyReview(applyReview(fresh, true, now), false, now);
    expect(r.repetitions).toBe(0);
    expect(r.nextReviewAt.getTime()).toBe(now.getTime());
    expect(r.lastIncorrectAt).toEqual(now);
  });

  it("mastery is 0 with no answers and bounded by 1", () => {
    expect(computeMastery(fresh)).toBe(0);
    expect(computeMastery({ timesCorrect: 100, timesIncorrect: 0, repetitions: 100 })).toBe(1);
  });
});
