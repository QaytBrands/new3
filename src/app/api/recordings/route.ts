import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { getPronunciationEngine } from "@/lib/pronunciation";
import { getStorage, recordingPath } from "@/lib/storage";
import { assertVocabularyAccess } from "@/server/student-data";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const vocabularyId = String(form.get("vocabularyId") ?? "");
  const transcript = String(form.get("transcript") ?? "").slice(0, 300) || null;
  const file = form.get("audio");

  const vocab = await assertVocabularyAccess(user.id, vocabularyId);
  if (!vocab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let audioUrl: string | null = null;
  if (file instanceof Blob && file.size > 0) {
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Recording too long" }, { status: 413 });
    const type = file.type || "audio/webm";
    if (!type.startsWith("audio/")) return NextResponse.json({ error: "Invalid audio" }, { status: 400 });
    const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
    try {
      audioUrl = (await getStorage().put(recordingPath(user.id, ext), file, type)).url;
    } catch (e) {
      console.error("Recording upload failed", e);
    }
  }

  const engine = getPronunciationEngine();
  const expectedText = vocab.german;
  const result = await engine.analyze({ expectedText, locale: "de-DE", audioUrl, clientTranscript: transcript });

  const attempt = await prisma.pronunciationAttempt.create({
    data: {
      userId: user.id,
      vocabularyId,
      audioUrl,
      transcript: result.transcription,
      transcriptMatches: result.transcriptMatches,
      engine: result.provider,
      score: result.score,
      feedback: result.errors.length || result.phonemes.length ? { errors: result.errors, phonemes: result.phonemes } : undefined,
    },
  });

  return NextResponse.json({ id: attempt.id, audioUrl, result });
}
