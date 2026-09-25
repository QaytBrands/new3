"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertStudent } from "@/lib/auth/guards";
import { finalizeAttempt, startAttempt, TestAccessError } from "./test-service";

export async function startTest(testId: string) {
  const user = await assertStudent();
  let attemptId: string;
  try {
    attemptId = await startAttempt(user.id, testId);
  } catch (e) {
    if (e instanceof TestAccessError) return { error: e.message };
    throw e;
  }
  redirect(`/attempts/${attemptId}`);
}

export async function submitTest(attemptId: string, answers: Record<number, string>) {
  const user = await assertStudent();
  const clean: Record<number, string> = {};
  for (const [k, v] of Object.entries(answers ?? {})) {
    const pos = Number(k);
    if (Number.isInteger(pos) && pos >= 0 && typeof v === "string") clean[pos] = v;
  }
  await finalizeAttempt(user.id, attemptId, clean);
  revalidatePath("/dashboard");
  redirect(`/attempts/${attemptId}`);
}
