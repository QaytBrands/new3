import { normalizeGerman } from "@/lib/tests/grading";
import type { PronunciationEngine, PronunciationInput, PronunciationResult } from "./types";

/** Records only; no analysis. */
export class NullEngine implements PronunciationEngine {
  readonly name = "none";
  readonly capabilities = { transcription: false, scoring: false, phonemeFeedback: false };
  async analyze(): Promise<PronunciationResult> {
    return {
      provider: this.name,
      capabilities: this.capabilities,
      transcription: null,
      transcriptMatches: null,
      score: null,
      errors: [],
      phonemes: [],
    };
  }
}

/**
 * Uses the transcript the browser's speech recognition produced. It can tell whether the
 * recogniser heard the expected word, but it cannot score pronunciation, so `score` is null.
 */
export class BrowserTranscriptEngine implements PronunciationEngine {
  readonly name = "browser-transcript";
  readonly capabilities = { transcription: true, scoring: false, phonemeFeedback: false };

  async analyze(input: PronunciationInput): Promise<PronunciationResult> {
    const transcription = input.clientTranscript?.trim() || null;
    return {
      provider: this.name,
      capabilities: this.capabilities,
      transcription,
      transcriptMatches: transcription ? transcriptMatches(transcription, input.expectedText) : null,
      score: null,
      errors: [],
      phonemes: [],
    };
  }
}

export function transcriptMatches(transcript: string, expected: string): boolean {
  const clean = (s: string) => normalizeGerman(s.replace(/[.,!?;:"„“]/g, ""));
  const t = clean(transcript);
  const e = clean(expected);
  return t === e || t.split(" ").includes(e);
}
