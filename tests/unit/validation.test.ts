import { describe, expect, it } from "vitest";
import { splitExamples, validateCsvRecords } from "@/lib/validation";
import { transcriptMatches } from "@/lib/pronunciation/engines";
import { BrowserTranscriptEngine } from "@/lib/pronunciation/engines";
import { nextInOrder } from "@/lib/progression";

describe("csv import validation", () => {
  it("parses valid rows and reports invalid ones with line numbers", () => {
    const res = validateCsvRecords([
      { level: "A1", chapter: "Greetings", day: "1", german: "Hallo", english: "hello", article: "", tags: "greeting; basic" },
      { level: "A1", chapter: "Family", day: "x", german: "", english: "mother", article: "dem" },
    ]);
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0].row.tags).toEqual(["greeting", "basic"]);
    expect(res.valid[0].row.article).toBeNull();
    expect(res.errors[0].line).toBe(3);
    expect(res.errors[0].messages.length).toBeGreaterThanOrEqual(3);
  });

  it("accepts only https or site-relative native audio URLs, and the legacy audio_url header", () => {
    const base = { level: "A1", chapter: "c", day: "1", german: "Hund", english: "dog" };
    const res = validateCsvRecords([
      { ...base, native_audio_url: "https://cdn.example.com/hund.mp3" },
      { ...base, audio_url: "/audio/hund.mp3" },
      { ...base, native_audio_url: "javascript:alert(1)" },
      { ...base, native_audio_url: "http://insecure.example.com/a.mp3" },
    ]);
    expect(res.valid.map((v) => v.row.nativeAudioUrl)).toEqual(["https://cdn.example.com/hund.mp3", "/audio/hund.mp3"]);
    expect(res.errors.map((e) => e.line)).toEqual([4, 5]);
  });

  it("uppercases articles", () => {
    const res = validateCsvRecords([{ level: "A1", chapter: "c", day: "2", german: "Hund", english: "dog", article: "Der" }]);
    expect(res.valid[0].row.article).toBe("DER");
  });

  it("splits multiple examples", () => {
    expect(splitExamples("Hallo! | Hallo, Anna.", "Hello! | Hello, Anna.")).toEqual([
      { german: "Hallo!", english: "Hello!" },
      { german: "Hallo, Anna.", english: "Hello, Anna." },
    ]);
  });
});

describe("pronunciation engine", () => {
  it("never fabricates a score", async () => {
    const r = await new BrowserTranscriptEngine().analyze({ expectedText: "Hund", locale: "de-DE", clientTranscript: "Hund" });
    expect(r.overallScore).toBeNull();
    expect(r.transcriptMatches).toBe(true);
  });

  it("compares transcripts leniently", () => {
    expect(transcriptMatches("der Hund.", "Hund")).toBe(true);
    expect(transcriptMatches("Hand", "Hund")).toBe(false);
  });
});

describe("progression", () => {
  it("finds the next item in order", () => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(nextInOrder(items, "a")).toEqual({ id: "b" });
    expect(nextInOrder(items, "b")).toBeNull();
  });
});
