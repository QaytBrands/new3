import { describe, expect, it } from "vitest";
import { AUDIO_SOURCE_LABELS, isAllowedAudioUrl, resolveAudioSource } from "@/lib/audio";
import { analyzePronunciation, getPronunciationEngine, type PronunciationEngine } from "@/lib/pronunciation";
import { canAccessRecording } from "@/lib/recording-access";

describe("audio source", () => {
  it("prefers native audio and falls back to labelled synthesis", () => {
    expect(resolveAudioSource("der Hund", "https://cdn/x.mp3")).toEqual({ kind: "native", url: "https://cdn/x.mp3", text: "der Hund" });
    expect(resolveAudioSource("der Hund", null)).toEqual({ kind: "synthesized", text: "der Hund", lang: "de-DE" });
    expect(resolveAudioSource("der Hund", "  ").kind).toBe("synthesized");
    expect(AUDIO_SOURCE_LABELS.synthesized).toBe("Synthesized voice");
  });

  it("only allows safe audio URLs", () => {
    expect(isAllowedAudioUrl("https://cdn.example.com/a.mp3")).toBe(true);
    expect(isAllowedAudioUrl("/audio/a.mp3")).toBe(true);
    expect(isAllowedAudioUrl("//evil.com/a.mp3")).toBe(false);
    expect(isAllowedAudioUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedAudioUrl("http://example.com/a.mp3")).toBe(false);
  });
});

describe("pronunciation service", () => {
  const input = { expectedText: "Hund", locale: "de-DE", clientTranscript: "Hund" };

  it("default engine transcribes but never scores", async () => {
    const engine = getPronunciationEngine(undefined);
    expect(engine.capabilities.scoring).toBe(false);
    const r = await analyzePronunciation(engine, input);
    expect(r).toMatchObject({ transcription: "Hund", transcriptMatches: true, overallScore: null, phonemes: [], issues: [] });
  });

  it("strips scores and feedback from engines that don't declare those capabilities", async () => {
    const liar: PronunciationEngine = {
      name: "liar",
      capabilities: { transcription: true, scoring: false, phonemeFeedback: false, issueDetection: false },
      analyze: async () => ({
        provider: "liar", capabilities: { transcription: true, scoring: false, phonemeFeedback: false, issueDetection: false },
        transcription: "Hund", transcriptMatches: true, overallScore: 97,
        phonemes: [{ phoneme: "ʊ", score: 90 }], issues: [{ type: "stress", message: "x" }],
      }),
    };
    const r = await analyzePronunciation(liar, input);
    expect(r.overallScore).toBeNull();
    expect(r.phonemes).toEqual([]);
    expect(r.issues).toEqual([]);
  });

  it("passes through (clamped) results from a real scoring provider", async () => {
    const caps = { transcription: true, scoring: true, phonemeFeedback: true, issueDetection: true };
    const scorer: PronunciationEngine = {
      name: "scorer",
      capabilities: caps,
      analyze: async () => ({
        provider: "scorer", capabilities: caps, transcription: "Hund", transcriptMatches: true, overallScore: 140,
        phonemes: [{ phoneme: "ʊ", expected: "ʊ", score: 88 }], issues: [{ type: "mispronunciation", message: "Vowel too long", phoneme: "ʊ" }],
      }),
    };
    const r = await analyzePronunciation(scorer, input);
    expect(r.overallScore).toBe(100);
    expect(r.phonemes[0].score).toBe(88);
    expect(r.issues).toHaveLength(1);
  });
});

describe("recording access", () => {
  const rec = { userId: "student-a" };
  it("allows the owner, admins and staff with VIEW_PROGRESS only", () => {
    expect(canAccessRecording({ id: "student-a", role: "STUDENT", permissions: [] }, rec)).toBe(true);
    expect(canAccessRecording({ id: "student-b", role: "STUDENT", permissions: [] }, rec)).toBe(false);
    expect(canAccessRecording({ id: "admin", role: "ADMIN", permissions: [] }, rec)).toBe(true);
    expect(canAccessRecording({ id: "s1", role: "STAFF", permissions: ["VIEW_STUDENTS"] }, rec)).toBe(false);
    expect(canAccessRecording({ id: "s2", role: "STAFF", permissions: ["VIEW_PROGRESS"] }, rec)).toBe(true);
    expect(canAccessRecording({ id: "s3", role: "STAFF", permissions: ["VIEW_PROGRESS"], active: false }, rec)).toBe(false);
    expect(canAccessRecording(null, rec)).toBe(false);
  });
});
