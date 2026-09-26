import type { Permission, Role } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Identity returned by the mocked `getIdentity()` (the Neon Auth session). Set with `signInAs`.
 * Only the stable Neon Auth user id is carried; everything else is loaded from the app database.
 */
export const session: { current: { userId: string; email: string } | null } = { current: null };

export function signInAs(user: { neonAuthUserId: string | null; email: string | null } | null) {
  session.current = user?.neonAuthUserId ? { userId: user.neonAuthUserId, email: user.email ?? "" } : null;
}

export const tag = `it_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}`;

/** App user linked to a synthetic Neon Auth id (for tests that mock the session). */
export async function makeUser(name: string, role: Role, extra: { permissions?: Permission[]; active?: boolean; timezone?: string } = {}) {
  const username = `${tag}_${name}`.toLowerCase();
  return prisma.user.create({
    data: {
      username,
      name,
      role,
      email: `${username}@integration.test`,
      neonAuthUserId: `na_${username}`,
      permissions: extra.permissions ?? [],
      active: extra.active ?? true,
      timezone: extra.timezone,
    },
  });
}

export function fd(values: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}

export async function cleanup() {
  await prisma.user.deleteMany({ where: { username: { startsWith: tag } } });
  await prisma.level.deleteMany({ where: { code: { startsWith: tag.toUpperCase() } } });
  await prisma.auditLog.deleteMany({ where: { target: { startsWith: tag } } });
}
