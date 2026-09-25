import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/auth/guards";
import { ProvisioningError } from "@/lib/auth/provisioning";
import { NeonAuthConfigError } from "@/lib/auth/neon-config";

export type FormState = { ok?: boolean; error?: string; message?: string; nonce?: number };

/** Runs an admin mutation and converts expected failures into form state. */
export async function run(fn: () => Promise<string | void>): Promise<FormState> {
  try {
    const message = await fn();
    return { ok: true, message: message ?? "Saved.", nonce: Date.now() };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { error: e.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ") };
    }
    if (e instanceof ForbiddenError) return { error: e.message };
    if (e instanceof UserFacingError) return { error: e.message };
    if (e instanceof ProvisioningError) return { error: e.message };
    if (e instanceof NeonAuthConfigError) return { error: `Sign-in accounts can't be managed: ${e.message}` };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "That value is already in use." };
    }
    throw e;
  }
}

export class UserFacingError extends Error {}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export async function audit(actorId: string, action: string, target?: string, meta?: Prisma.InputJsonValue) {
  await prisma.auditLog.create({ data: { actorId, action, target, meta } });
}

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, "Username must be 3–40 characters: letters, numbers, dot, dash or underscore");

export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);

/** Sign-in email (Neon Auth identifier). Stored lowercase. */
export const emailSchema = z.email("A valid email is required (it is used to sign in).").transform((e) => e.toLowerCase());
/** Optional email on edit forms: blank means "unchanged". */
export const optionalEmailSchema = z.union([z.literal(""), z.email()]).transform((e) => (e ? e.toLowerCase() : null));
