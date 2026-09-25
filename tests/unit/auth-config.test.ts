import { describe, expect, it } from "vitest";
import { loginUrlFor } from "@/lib/auth/routes";
import { getAppOrigin, getNeonAuthSettings, getProvisionerCredentials, isNeonAuthConfigured } from "@/lib/auth/neon-config";
import { normalizeHandle, PORTAL_ROLES } from "@/lib/auth/login";
import { isProductionEnvironment } from "../../prisma/seed-identities";

describe("proxy routing", () => {
  it("sends each area to its own sign-in page", () => {
    expect(loginUrlFor("/dashboard")).toBe("/login");
    expect(loginUrlFor("/lessons/abc/pronounce")).toBe("/login");
    expect(loginUrlFor("/attempts/1")).toBe("/login");
    expect(loginUrlFor("/admin")).toBe("/admin/login");
    expect(loginUrlFor("/admin/students/1")).toBe("/admin/login");
  });

  it("leaves sign-in pages and public paths alone", () => {
    for (const p of ["/login", "/admin/login", "/", "/vocabulary-template.csv", "/loginx"]) expect(loginUrlFor(p), p).toBeNull();
    expect(loginUrlFor("/administrator")).toBeNull(); // prefix must be a whole path segment
    expect(loginUrlFor("/dashboards")).toBeNull();
  });
});

describe("portal roles", () => {
  it("students only on the student portal; admin and staff only on the staff portal", () => {
    expect(PORTAL_ROLES.student).toEqual(["STUDENT"]);
    expect([...PORTAL_ROLES.staff].sort()).toEqual(["ADMIN", "STAFF"]);
  });

  it("normalises handles", () => {
    expect(normalizeHandle("  Admin@Example.COM ")).toBe("admin@example.com");
    expect(normalizeHandle(undefined)).toBe("");
  });
});

describe("Neon Auth configuration", () => {
  const ok = { NEON_AUTH_BASE_URL: "https://ep-x.neonauth.us-east-2.aws.neon.tech/neondb/auth/", NEON_AUTH_COOKIE_SECRET: "s".repeat(32) };

  it("reads NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET", () => {
    expect(getNeonAuthSettings(ok)).toEqual({ baseUrl: "https://ep-x.neonauth.us-east-2.aws.neon.tech/neondb/auth", cookieSecret: "s".repeat(32) });
    expect(isNeonAuthConfigured(ok)).toBe(true);
  });

  it("rejects missing URL or a cookie secret shorter than 32 characters", () => {
    expect(isNeonAuthConfigured({})).toBe(false);
    expect(isNeonAuthConfigured({ ...ok, NEON_AUTH_COOKIE_SECRET: "short" })).toBe(false);
    expect(() => getNeonAuthSettings({ NEON_AUTH_COOKIE_SECRET: "s".repeat(32) })).toThrow(/NEON_AUTH_BASE_URL/);
  });

  it("derives the app origin from APP_ORIGIN or Vercel's production URL", () => {
    expect(getAppOrigin({ APP_ORIGIN: "https://learn.example.org/" })).toBe("https://learn.example.org");
    expect(getAppOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "wortweg.vercel.app" })).toBe("https://wortweg.vercel.app");
    expect(() => getAppOrigin({})).toThrow(/APP_ORIGIN/);
  });

  it("requires provisioner credentials", () => {
    expect(getProvisionerCredentials({ AUTH_PROVISIONER_EMAIL: "Svc@X.io", AUTH_PROVISIONER_PASSWORD: "p" })).toEqual({ email: "svc@x.io", password: "p" });
    expect(() => getProvisionerCredentials({})).toThrow();
  });
});

describe("seed safety", () => {
  it("treats NODE_ENV=production and VERCEL_ENV=production as production (demo account refused)", () => {
    expect(isProductionEnvironment({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionEnvironment({ VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionEnvironment({ NODE_ENV: "development", VERCEL_ENV: "preview" })).toBe(false);
  });
});
