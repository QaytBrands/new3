export type PronunciationCapabilities = {
  transcription: boolean;
  scoring: boolean;
  phonemeFeedback: boolean;
};

export type PronunciationInput = {
  expectedText: string;
  locale: string;
  /** URL of the stored recording, if any */
  audioUrl?: string | null;
  /** Transcript produced on the client (e.g. Web Speech API), if any */
  clientTranscript?: string | null;
};

export type PhonemeFeedback = { phoneme: string; expected?: string; score?: number; note?: string };

export type PronunciationResult = {
  provider: string;
  capabilities: PronunciationCapabilities;
  transcription: string | null;
  /** Text comparison of transcript vs expected. This is NOT a pronunciation score. */
  transcriptMatches: boolean | null;
  /** 0–100, only when a real scoring provider produced it. Never fabricated. */
  score: number | null;
  errors: string[];
  phonemes: PhonemeFeedback[];
};

/**
 * Provider abstraction for pronunciation analysis. Implementations may transcribe, score,
 * or return phoneme-level feedback; they must return null for anything they cannot measure.
 */
export interface PronunciationEngine {
  readonly name: string;
  readonly capabilities: PronunciationCapabilities;
  analyze(input: PronunciationInput): Promise<PronunciationResult>;
}
