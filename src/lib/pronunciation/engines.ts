import { normalizeGerman } from "@/lib/tests/grading";
import type { PronunciationEngine, PronunciationInput, PronunciationResult } from "./types";

const NO_ANALYSIS = { transcription: false, scoring: false, phonemeFeedback: false, issueDetection: false };

/** Stores recordings only; no analysis. */
export class NullEngine implements PronunciationEngine {
  readonly name = "none";
  readonly capabilities = NO_ANALYSIS;
  async analyze(): Promise<PronunciationResult> {
    return { provider: this.name, capabilities: this.capabilities, transcription: null, transcriptMatches: null, overallScore: null, phonemes: [], issues: [] };
  }
}

/**
 * Uses the transcript the browser's speech recognition produced. It can tell whether the
 * recogniser heard the expected word, but it cannot score pronunciation.
 */
export class BrowserTranscriptEngine implements PronunciationEngine {
  readonly name = "browser-transcript";
  readonly capabilities = { ...NO_ANALYSIS, transcription: true };

  async analyze(input: PronunciationInput): Promise<PronunciationResult> {
    const transcription = input.clientTranscript?.trim().slice(0, 300) || null;
    return {
      provider: this.name,
      capabilities: this.capabilities,
      transcription,
      transcriptMatches: transcription ? transcriptMatches(transcription, input.expectedText) : null,
      overallScore: null,
      phonemes: [],
      issues: [],
    };
  }
}

export function transcriptMatches(transcript: string, expected: string): boolean {
  const clean = (s: string) => normalizeGerman(s.replace(/[.,!?;:"„“]/g, ""));
  const t = clean(transcript);
  const e = clean(expected);
  return t === e || t.split(" ").includes(e);
}
