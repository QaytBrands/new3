import type { Role, User } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Failed sign-ins per handle allowed within the window before further attempts are refused. */
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Every rejected attempt takes at least this long, so response time doesn't reveal why it failed. */
export const MIN_FAILURE_MS = 400;

export type Portal = "student" | "staff";

export const PORTAL_ROLES: Record<Portal, readonly Role[]> = {
  student: ["STUDENT"],
  staff: ["ADMIN", "STAFF"],
};

/** Performs the Neon Auth email/password sign-in; returns the authenticated Neon Auth user id or null. */
export type NeonSignIn = (email: string, password: string) => Promise<{ userId: string } | null>;

export type LoginResult = { ok: true; user: User } | { ok: false; reason: "invalid" | "throttled" };

export function normalizeHandle(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase().slice(0, 254);
}

async function recentFailures(handle: string) {
  return prisma.auditLog.count({
    where: { action: "auth.failed", target: handle, createdAt: { gte: new Date(Date.now() - LOGIN_WINDOW_MS) } },
  });
}

/**
 * Signs a user in through a specific portal.
 *
 * The application decides *who* may use the portal (role, active, linked identity) before Neon Auth
 * is asked to verify the password, so a staff account can never obtain a session through the student
 * login (and vice versa), and deactivated accounts are refused even if their identity still exists.
 * After Neon Auth succeeds, the returned identity id must equal the stored `neonAuthUserId`.
 *
 * `onMismatch` is invoked if Neon Auth authenticated a different identity than expected, so the
 * caller can discard the session it just created.
 */
export async function authenticate(
  portal: Portal,
  rawHandle: unknown,
  rawPassword: unknown,
  signIn: NeonSignIn,
  onMismatch: () => Promise<void> = async () => {},
): Promise<LoginResult> {
  const started = Date.now();
  const handle = normalizeHandle(rawHandle);
  const password = String(rawPassword ?? "").slice(0, 200);

  const fail = async (reason: "invalid" | "throttled"): Promise<LoginResult> => {
    if (handle) await prisma.auditLog.create({ data: { action: "auth.failed", target: handle } });
    const wait = MIN_FAILURE_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return { ok: false, reason };
  };

  if (!handle || !password) return fail("invalid");
  // Throttle password guessing per account; stored in the DB so it holds across serverless instances.
  if ((await recentFailures(handle)) >= LOGIN_MAX_FAILURES) return fail("throttled");

  const user = await prisma.user.findUnique({ where: handle.includes("@") ? { email: handle } : { username: handle } });
  if (!user || !user.active || !PORTAL_ROLES[portal].includes(user.role) || !user.neonAuthUserId || !user.email) {
    return fail("invalid");
  }

  const identity = await signIn(user.email, password);
  if (!identity) return fail("invalid");
  if (identity.userId !== user.neonAuthUserId) {
    await onMismatch();
    return fail("invalid");
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  return { ok: true, user: updated };
}
