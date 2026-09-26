/**
 * Neon Auth configuration. Shared by the request-scoped server client, `proxy.ts`, account
 * provisioning and the seed script, so it must not import Next.js or `server-only`.
 *
 * Variables defined by Neon Auth (see @neondatabase/auth docs):
 *   NEON_AUTH_BASE_URL       Neon Auth URL for the branch (Neon Console → Auth → Configuration)
 *   NEON_AUTH_COOKIE_SECRET  ≥32 chars; signs the cached `session_data` cookie
 * Variables defined by this application:
 *   AUTH_PROVISIONER_EMAIL / AUTH_PROVISIONER_PASSWORD  Neon Auth service account with the "admin"
 *     role, used server-side only to create accounts, set passwords and ban/unban identities
 *   APP_ORIGIN  public origin of this app (a Neon Auth trusted domain); sent as `Origin` on
 *     server-to-Neon-Auth calls made outside a browser request (provisioning, seeding)
 */

/** Plain environment map (process.env, or an explicit object in tests/scripts). */
export type Env = Record<string, string | undefined>;

/** Seconds a signed session snapshot is trusted before re-validating with Neon Auth. */
export const SESSION_DATA_TTL_SECONDS = 60;

export type NeonAuthSettings = { baseUrl: string; cookieSecret: string };

export class NeonAuthConfigError extends Error {}

export function getNeonAuthSettings(env: Env = process.env): NeonAuthSettings {
  const baseUrl = env.NEON_AUTH_BASE_URL?.trim().replace(/\/+$/, "");
  const cookieSecret = env.NEON_AUTH_COOKIE_SECRET ?? "";
  if (!baseUrl) throw new NeonAuthConfigError("NEON_AUTH_BASE_URL is not set.");
  if (cookieSecret.length < 32) throw new NeonAuthConfigError("NEON_AUTH_COOKIE_SECRET must be at least 32 characters.");
  return { baseUrl, cookieSecret };
}

export function isNeonAuthConfigured(env: Env = process.env): boolean {
  try {
    getNeonAuthSettings(env);
    return true;
  } catch {
    return false;
  }
}

export function getAppOrigin(env: Env = process.env): string {
  const explicit = env.APP_ORIGIN?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  // Vercel system variable: the production domain, without protocol.
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  throw new NeonAuthConfigError("APP_ORIGIN is not set.");
}

export function getProvisionerCredentials(env: Env = process.env): { email: string; password: string } {
  const email = env.AUTH_PROVISIONER_EMAIL?.trim().toLowerCase();
  const password = env.AUTH_PROVISIONER_PASSWORD;
  if (!email || !password) throw new NeonAuthConfigError("AUTH_PROVISIONER_EMAIL and AUTH_PROVISIONER_PASSWORD must be set.");
  return { email, password };
}
