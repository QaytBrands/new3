import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Permission } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hasPermission, isAdmin } from "@/lib/permissions";
import { safeTimeZone } from "@/lib/time";
import { getIdentity } from "./neon-server";

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do this.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * The application user for the current request, or null.
 *
 * Neon Auth only establishes *who* is signed in (a stable Neon Auth user id). Everything else —
 * role, active status, permissions — is loaded fresh from the application database on every
 * request, so role/permission/deactivation changes apply immediately. An identity with no linked
 * application user gets nothing.
 */
export const getCurrentUser = cache(async () => {
  const identity = await getIdentity();
  if (!identity) return null;
  const user = await prisma.user.findUnique({
    where: { neonAuthUserId: identity.userId },
    select: { id: true, name: true, username: true, role: true, permissions: true, active: true, lastActiveAt: true, timezone: true },
  });
  if (!user || !user.active) return null;
  return { ...user, timezone: safeTimeZone(user.timezone) };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireStudent() {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") redirect("/login");
  if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > 5 * 60 * 1000) {
    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  }
  return user;
}

export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) redirect("/admin/login");
  return user;
}

/** For pages: redirect to a forbidden page when the permission is missing. */
export async function requirePagePermission(permission: Permission) {
  const user = await requireStaff();
  if (!hasPermission(user, permission)) redirect("/admin/forbidden");
  return user;
}

export async function requirePageAdmin() {
  const user = await requireStaff();
  if (!isAdmin(user)) redirect("/admin/forbidden");
  return user;
}

/** For server actions: throw instead of redirecting. */
export async function assertPermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, permission)) throw new ForbiddenError();
  return user;
}

export async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) throw new ForbiddenError();
  return user;
}

export async function assertStudent() {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") throw new ForbiddenError();
  return user;
}

/** Curriculum pages are visible to anyone who can manage some part of the curriculum. */
export async function requireCurriculumViewer() {
  const user = await requireStaff();
  const { canViewCurriculum } = await import("@/lib/admin-nav");
  if (!canViewCurriculum(user)) redirect("/admin/forbidden");
  return user;
}
