import "server-only";
import { cookies, headers } from "next/headers";
import { createAuthServer, extractNeonAuthCookies, NEON_AUTH_COOKIE_PREFIX } from "@neondatabase/auth/server";
import { getNeonAuthSettings, isNeonAuthConfigured, SESSION_DATA_TTL_SECONDS } from "./neon-config";

/**
 * Neon Auth client bound to the current Next.js request (the signed-in user's own cookies).
 *
 * Built with `createAuthServer` from `@neondatabase/auth/server`, the toolkit the SDK's own Next.js
 * adapter uses. The only difference: in Server Components cookies are read-only, so a cookie
 * refresh there is skipped instead of throwing — `proxy.ts` runs first on every page request and
 * persists refreshed cookies.
 */
let client: ReturnType<typeof createAuthServer> | null = null;

export function neonAuth() {
  if (client) return client;
  const { baseUrl, cookieSecret } = getNeonAuthSettings();
  client = createAuthServer({
    baseUrl,
    cookieSecret,
    sessionDataTtl: SESSION_DATA_TTL_SECONDS,
    sameSite: "lax",
    context: async () => {
      const cookieStore = await cookies();
      const headerStore = await headers();
      return {
        getCookies: () => extractNeonAuthCookies(headerStore),
        setCookie: (name, value, options) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Read-only in Server Components; proxy.ts handles refreshes on page requests.
          }
        },
        getHeader: (name) => headerStore.get(name),
        getOrigin: () => {
          const origin = headerStore.get("origin");
          if (origin) return origin;
          const referer = headerStore.get("referer");
          return referer ? referer.split("/").slice(0, 3).join("/") : "";
        },
        getFramework: () => "nextjs",
      };
    },
  });
  return client;
}

export type Identity = { userId: string; email: string };

/**
 * The Neon Auth identity of the current request, or null. Never throws: a missing/invalid/expired
 * session or an unreachable auth service is treated as "not signed in".
 */
export async function getIdentity(): Promise<Identity | null> {
  if (!isNeonAuthConfigured()) return null;
  try {
    const { data } = await neonAuth().getSession();
    const user = data?.user;
    return user?.id ? { userId: user.id, email: user.email } : null;
  } catch {
    return null;
  }
}

/** Removes every Neon Auth cookie from the response (used on sign-out and on rejected sign-ins). */
export async function clearNeonAuthCookies() {
  const cookieStore = await cookies();
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith(NEON_AUTH_COOKIE_PREFIX)) cookieStore.set(c.name, "", { path: "/", maxAge: 0, secure: true, httpOnly: true, sameSite: "lax" });
  }
}
