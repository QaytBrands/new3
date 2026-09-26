/** Student-area path prefixes (must be signed in; role is enforced by requireStudent on each page). */
export const STUDENT_PREFIXES = ["/dashboard", "/levels", "/chapters", "/lessons", "/tests", "/attempts", "/progress", "/words"] as const;

export const STUDENT_LOGIN = "/login";
export const STAFF_LOGIN = "/admin/login";

const within = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

/**
 * Which sign-in page protects a path, or null for public paths. The proxy only checks that a
 * Neon Auth session exists; role checks happen server-side in the page/action guards.
 */
export function loginUrlFor(pathname: string): typeof STUDENT_LOGIN | typeof STAFF_LOGIN | null {
  if (within(pathname, STAFF_LOGIN) || within(pathname, STUDENT_LOGIN)) return null;
  if (within(pathname, "/admin")) return STAFF_LOGIN;
  if (STUDENT_PREFIXES.some((p) => within(pathname, p))) return STUDENT_LOGIN;
  return null;
}
