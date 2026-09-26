import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { IdentityAdmin } from "@/lib/auth/provisioning";
import { ensureLinkedUser } from "../../prisma/seed-identities";
import { seedSampleCurriculum } from "../../prisma/sample-curriculum";

/**
 * One-time, browser-based first-run setup: creates the first admin (linked to a Neon Auth identity)
 * and optionally the sample course. Available only while no admin exists. The setup key is the
 * AUTH_PROVISIONER_PASSWORD value, so only whoever configured the deployment can use it.
 */

export const SETUP_MAX_FAILURES = 10;
export const SETUP_WINDOW_MS = 15 * 60 * 1000;

const inputSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.email("Enter a valid email address.").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "The password must be at least 8 characters.").max(200),
  loadSample: z.boolean(),
});

export type SetupResult = { ok: true } | { ok: false; error: string };

export async function isSetupComplete(): Promise<boolean> {
  return (await prisma.user.count({ where: { role: "ADMIN" } })) > 0;
}

export function setupKeyMatches(given: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function runFirstTimeSetup(
  raw: { setupKey: string; name: string; email: string; password: string; loadSample: boolean },
  identities: () => IdentityAdmin,
  env: Record<string, string | undefined> = process.env,
): Promise<SetupResult> {
  if (await isSetupComplete()) return { ok: false, error: "Setup has already been completed." };

  const since = new Date(Date.now() - SETUP_WINDOW_MS);
  const failures = await prisma.auditLog.count({ where: { action: "setup.failed", createdAt: { gte: since } } });
  if (failures >= SETUP_MAX_FAILURES) return { ok: false, error: "Too many attempts. Try again in 15 minutes." };

  if (!setupKeyMatches(raw.setupKey, env.AUTH_PROVISIONER_PASSWORD)) {
    await prisma.auditLog.create({ data: { action: "setup.failed", target: "setup" } });
    return { ok: false, error: "The setup key is not correct." };
  }

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  const input = parsed.data;

  await prisma.appSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const admin = await ensureLinkedUser(prisma, identities(), {
    username: "admin",
    name: input.name,
    role: "ADMIN",
    email: input.email,
    password: input.password,
  });
  if (input.loadSample) await seedSampleCurriculum(prisma);
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "setup.completed", target: admin.id } });
  return { ok: true };
}
