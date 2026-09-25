import "server-only";
import { prisma } from "@/lib/db";
export { canAccessRecording } from "@/lib/recording-access";
import { analyzePronunciation, getPronunciationEngine, type PronunciationResult } from "@/lib/pronunciation";
import { getStorage, recordingKey } from "@/lib/storage";
import { assertVocabularyAccess } from "./student-data";

export const MAX_RECORDING_BYTES = 2 * 1024 * 1024;

export class RecordingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Stores a student's recording privately, runs the configured PronunciationEngine and persists
 * the attempt. The student must have access to the word's lesson.
 */
export async function recordPronunciationAttempt(input: {
  userId: string;
  vocabularyId: string;
  audio: Blob | null;
  clientTranscript: string | null;
}): Promise<{ id: string; result: PronunciationResult }> {
  const vocab = await assertVocabularyAccess(input.userId, input.vocabularyId);
  if (!vocab) throw new RecordingError("Not found", 404);

  let audioKey: string | null = null;
  let audioBytes: { data: Uint8Array; contentType: string } | null = null;
  if (input.audio && input.audio.size > 0) {
    if (input.audio.size > MAX_RECORDING_BYTES) throw new RecordingError("Recording too long", 413);
    const contentType = (input.audio.type || "audio/webm").split(";")[0];
    if (!contentType.startsWith("audio/")) throw new RecordingError("Invalid audio", 400);
    const ext = contentType.includes("mp4") ? "m4a" : contentType.includes("ogg") ? "ogg" : "webm";
    audioBytes = { data: new Uint8Array(await input.audio.arrayBuffer()), contentType };
    try {
      audioKey = (await getStorage().put(recordingKey(input.userId, ext), input.audio, contentType)).key;
    } catch (e) {
      console.error("Recording upload failed", e);
    }
  }

  const result = await analyzePronunciation(getPronunciationEngine(), {
    expectedText: vocab.german,
    locale: "de-DE",
    audio: audioBytes,
    clientTranscript: input.clientTranscript,
  });

  const attempt = await prisma.pronunciationAttempt.create({
    data: {
      userId: input.userId,
      vocabularyId: input.vocabularyId,
      audioKey,
      transcript: result.transcription,
      transcriptMatches: result.transcriptMatches,
      engine: result.provider,
      score: result.overallScore,
      feedback: result.phonemes.length || result.issues.length ? { phonemes: result.phonemes, issues: result.issues } : undefined,
    },
  });
  return { id: attempt.id, result };
}

export function recordingAudioPath(attemptId: string) {
  return `/api/recordings/${attemptId}/audio`;
}
