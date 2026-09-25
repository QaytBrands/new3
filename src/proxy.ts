import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_AUTH_SKIP_ROUTES, processAuthMiddleware } from "@neondatabase/auth/server";
import { getNeonAuthSettings, isNeonAuthConfigured, SESSION_DATA_TTL_SECONDS } from "@/lib/auth/neon-config";
import { loginUrlFor, STAFF_LOGIN, STUDENT_LOGIN } from "@/lib/auth/routes";

const SKIP_ROUTES = [...DEFAULT_AUTH_SKIP_ROUTES, STUDENT_LOGIN, STAFF_LOGIN];

/**
 * First gate only: requires a valid Neon Auth session on protected areas and refreshes session
 * cookies, sending signed-out visitors to the right sign-in page (students → /login, admin/staff →
 * /admin/login). It does not decide roles or permissions — every page, server action and API
 * route re-checks those against the application database.
 *
 * Mirrors the response handling of the SDK's own `neonAuthMiddleware`, with a per-area login URL.
 */
export async function proxy(request: NextRequest) {
  const loginUrl = loginUrlFor(request.nextUrl.pathname);
  if (!loginUrl) return NextResponse.next();
  if (!isNeonAuthConfigured()) return NextResponse.redirect(new URL(loginUrl, request.url));

  const { baseUrl, cookieSecret } = getNeonAuthSettings();
  const result = await processAuthMiddleware({
    request,
    pathname: request.nextUrl.pathname,
    skipRoutes: SKIP_ROUTES,
    loginUrl,
    baseUrl,
    cookieSecret,
    sessionDataTtl: SESSION_DATA_TTL_SECONDS,
    sameSite: "lax",
    logLevel: "error",
  });

  switch (result.action) {
    case "allow": {
      const headers = new Headers(request.headers);
      for (const [key, value] of Object.entries(result.headers ?? {})) headers.set(key, value);
      const response = NextResponse.next({ request: { headers } });
      for (const cookie of result.cookies ?? []) response.headers.append("Set-Cookie", cookie);
      return response;
    }
    case "redirect_oauth":
    case "redirect_login": {
      const headers = new Headers();
      for (const cookie of result.cookies ?? []) headers.append("Set-Cookie", cookie);
      return NextResponse.redirect(result.redirectUrl, { headers });
    }
  }
}

export const config = {
  // API routes authenticate themselves (and must return 401/404, not a redirect).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
