import type { PronunciationEngine, PronunciationInput, PronunciationResult } from "./types";

function clampScore(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : null;
}

/**
 * Runs an engine and enforces its declared capabilities: an engine that does not declare
 * `scoring` can never surface a score, even if it returns one by mistake.
 */
export async function analyzePronunciation(engine: PronunciationEngine, input: PronunciationInput): Promise<PronunciationResult> {
  const raw = await engine.analyze(input);
  const caps = engine.capabilities;
  return {
    provider: engine.name,
    capabilities: caps,
    transcription: caps.transcription ? raw.transcription?.slice(0, 300) ?? null : null,
    transcriptMatches: caps.transcription ? raw.transcriptMatches ?? null : null,
    overallScore: caps.scoring ? clampScore(raw.overallScore) : null,
    phonemes: caps.phonemeFeedback ? (raw.phonemes ?? []).map((p) => ({ ...p, score: clampScore(p.score) })) : [],
    issues: caps.issueDetection ? raw.issues ?? [] : [],
  };
}
