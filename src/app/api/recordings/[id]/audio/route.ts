import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { getStorage } from "@/lib/storage";
import { canAccessRecording } from "@/server/pronunciation-service";

/** Streams a private recording to its owner or to authorised staff. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const attempt = await prisma.pronunciationAttempt.findUnique({ where: { id }, select: { userId: true, audioKey: true } });
  // Same 404 for "missing" and "not yours" so ids can't be probed.
  if (!attempt || !attempt.audioKey || !canAccessRecording(user, attempt)) return new Response("Not found", { status: 404 });
  const file = await getStorage()?.get(attempt.audioKey);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.body, {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
