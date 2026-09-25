import bcrypt from "bcryptjs";
import type { Permission, Role } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Session used by the mocked `auth()`; set with `signInAs`. */
export const session: { current: { user: { id: string; role: Role } } | null } = { current: null };

export function signInAs(user: { id: string; role: Role } | null) {
  session.current = user ? { user: { id: user.id, role: user.role } } : null;
}

export const tag = `it_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}`;

export async function makeUser(name: string, role: Role, extra: { permissions?: Permission[]; active?: boolean; timezone?: string } = {}) {
  return prisma.user.create({
    data: {
      username: `${tag}_${name}`.toLowerCase(),
      name,
      role,
      passwordHash: await bcrypt.hash("correct-horse", 4),
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

