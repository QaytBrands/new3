import type { Permission } from "@prisma/client";
import { hasPermission, isAdmin, type Actor } from "./permissions";

type Item = { href: string; label: string; show: (a: Actor) => boolean };

const any = (...perms: Permission[]) => (a: Actor) => perms.some((p) => hasPermission(a, p));

export const ADMIN_NAV: Item[] = [
  { href: "/admin", label: "Dashboard", show: () => true },
  { href: "/admin/students", label: "Students", show: any("VIEW_STUDENTS") },
  { href: "/admin/curriculum", label: "Curriculum", show: any("MANAGE_LEVELS", "MANAGE_CHAPTERS", "MANAGE_VOCABULARY", "MANAGE_SENTENCES", "MANAGE_TESTS") },
  { href: "/admin/vocabulary/import", label: "Import vocabulary", show: any("MANAGE_VOCABULARY") },
  { href: "/admin/tests", label: "Tests", show: any("MANAGE_TESTS") },
  { href: "/admin/results", label: "Test results", show: any("VIEW_TEST_RESULTS") },
  { href: "/admin/pronunciation", label: "Pronunciation", show: isAdmin },
  { href: "/admin/staff", label: "Staff", show: isAdmin },
  { href: "/admin/settings", label: "Settings", show: isAdmin },
];

export function canViewCurriculum(a: Actor) {
  return ADMIN_NAV[2].show(a);
}
