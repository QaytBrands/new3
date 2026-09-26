/**
 * Pronunciation analysis contract. Engines report only what they can actually measure:
 * anything outside their declared capabilities is returned as null / empty and is also
 * stripped by `analyzePronunciation` as a safeguard. No engine may invent a score.
 */
export type PronunciationCapabilities = {
  /** Produces a transcript of what was said */
  transcription: boolean;
  /** Produces an overall pronunciation score (0–100) */
  scoring: boolean;
  /** Produces per-phoneme feedback */
  phonemeFeedback: boolean;
  /** Detects specific pronunciation issues (mispronounced/omitted sounds, stress, …) */
  issueDetection: boolean;
};

export type PronunciationInput = {
  /** The text the student was asked to say */
  expectedText: string;
  /** BCP-47 locale, e.g. "de-DE" */
  locale: string;
  /** Raw recording, for providers that analyse audio server-side */
  audio?: { data: Uint8Array; contentType: string } | null;
  /** Transcript produced in the browser (Web Speech API), if any */
  clientTranscript?: string | null;
};

export type PhonemeFeedback = {
  /** Phoneme actually detected (IPA) */
  phoneme: string;
  /** Phoneme expected at this position (IPA) */
  expected?: string;
  /** 0–100, provider-defined accuracy for this phoneme */
  score: number | null;
  startMs?: number;
  endMs?: number;
};

export type PronunciationIssue = {
  type: "mispronunciation" | "omission" | "insertion" | "stress" | "other";
  message: string;
  word?: string;
  phoneme?: string;
};

export type PronunciationResult = {
  provider: string;
  capabilities: PronunciationCapabilities;
  transcription: string | null;
  /** Text comparison of transcript vs expected text. NOT a pronunciation score. */
  transcriptMatches: boolean | null;
  /** 0–100 — only from a real scoring provider. */
  overallScore: number | null;
  phonemes: PhonemeFeedback[];
  issues: PronunciationIssue[];
};

export interface PronunciationEngine {
  readonly name: string;
  readonly capabilities: PronunciationCapabilities;
  analyze(input: PronunciationInput): Promise<PronunciationResult>;
}
