import type { Permission, Role } from "@prisma/client";

export const PERMISSIONS: { value: Permission; label: string }[] = [
  { value: "VIEW_STUDENTS", label: "View students" },
  { value: "CREATE_STUDENTS", label: "Create students" },
  { value: "EDIT_STUDENTS", label: "Edit students" },
  { value: "VIEW_PROGRESS", label: "View progress" },
  { value: "MANAGE_LEVELS", label: "Manage levels" },
  { value: "MANAGE_CHAPTERS", label: "Manage chapters" },
  { value: "MANAGE_VOCABULARY", label: "Manage vocabulary" },
  { value: "MANAGE_SENTENCES", label: "Manage sentences" },
  { value: "MANAGE_TESTS", label: "Manage tests" },
  { value: "UNLOCK_CHAPTERS", label: "Unlock chapters" },
  { value: "UNLOCK_LEVELS", label: "Unlock levels" },
  { value: "VIEW_TEST_RESULTS", label: "View test results" },
];

const ALL = new Set(PERMISSIONS.map((p) => p.value));

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && ALL.has(value as Permission);
}

export type Actor = { role: Role; permissions: readonly Permission[]; active?: boolean };

/**
 * Deny by default. Admins hold every permission; staff hold only the permissions
 * explicitly granted to them; students hold none.
 */
export function hasPermission(actor: Actor | null | undefined, permission: Permission): boolean {
  if (!actor || actor.active === false) return false;
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "STAFF") return false;
  return actor.permissions.includes(permission);
}

/** Admin-only capabilities that are never delegable to staff. */
export function isAdmin(actor: Actor | null | undefined): boolean {
  return !!actor && actor.active !== false && actor.role === "ADMIN";
}

/** Sanitise a permission list coming from a form: unknown values are dropped. */
export function parsePermissions(values: unknown[]): Permission[] {
  return [...new Set(values.filter(isPermission))];
}
