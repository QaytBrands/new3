import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { recordPronunciationAttempt, RecordingError } from "@/server/pronunciation-service";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const audio = form.get("audio");
  try {
    const { id, result, audioSaved } = await recordPronunciationAttempt({
      userId: user.id,
      vocabularyId: String(form.get("vocabularyId") ?? ""),
      audio: audio instanceof Blob ? audio : null,
      clientTranscript: String(form.get("transcript") ?? "").slice(0, 300) || null,
    });
    return NextResponse.json({ id, result, audioSaved });
  } catch (e) {
    if (e instanceof RecordingError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
