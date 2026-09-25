/**
 * Authentication against the Neon Auth stand-in using the real @neondatabase/auth SDK
 * (no mocks on the auth path). Replaces the Auth.js-era login-throttle tests.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";
import { createAuthServer } from "@neondatabase/auth/server";
import { prisma } from "@/lib/db";
import { authenticate, LOGIN_MAX_FAILURES, type NeonSignIn } from "@/lib/auth/login";
import { createIdentityAdmin } from "@/lib/auth/provisioning";
import { getNeonAuthSettings } from "@/lib/auth/neon-config";
import { cleanup, tag } from "./setup";

const PASSWORD = "correct-horse-1";

/** A browser-like client: its own cookie jar, the real SDK, the app's origin. */
function browser() {
  const jar = new Map<string, string>();
  const { baseUrl, cookieSecret } = getNeonAuthSettings();
  const client = createAuthServer({
    baseUrl,
    cookieSecret,
    log: { debug() {}, info() {}, warn() {}, error() {} },
    context: () => ({
      getCookies: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      setCookie: (n, v, o) => {
        if (!v || o.maxAge === 0) jar.delete(n);
        else jar.set(n, v);
      },
      getHeader: () => null,
      getOrigin: () => process.env.APP_ORIGIN!,
      getFramework: () => "test",
    }),
  });
  const signIn: NeonSignIn = async (email, password) => {
    const { data, error } = await client.signIn.email({ email, password });
    return error || !data?.user?.id ? null : { userId: data.user.id };
  };
  return { jar, client, signIn };
}

const ids = createIdentityAdmin();
let student: User, staff: User, admin: User, deactivated: User, legacy: User;

async function linkedUser(name: string, role: User["role"], extra: Partial<User> = {}) {
  const username = `${tag}_${name}`.toLowerCase();
  const email = `${username}@integration.test`;
  const identity = await ids.createIdentity({ email, password: PASSWORD, name });
  return prisma.user.create({ data: { username, name, role, email, neonAuthUserId: identity.id, ...extra } });
}

beforeAll(async () => {
  student = await linkedUser("auth_student", "STUDENT");
  staff = await linkedUser("auth_staff", "STAFF", { permissions: ["VIEW_STUDENTS"] });
  admin = await linkedUser("auth_admin", "ADMIN");
  deactivated = await linkedUser("auth_off", "STUDENT", { active: false });
  // An account created before the migration: no Neon Auth identity yet.
  legacy = await prisma.user.create({ data: { username: `${tag}_legacy`, name: "Legacy", role: "STUDENT", email: `${tag}_legacy@integration.test` } });
});

afterAll(async () => {
  for (const u of [student, staff, admin, deactivated]) if (u?.neonAuthUserId) await ids.remove(u.neonAuthUserId).catch(() => {});
  await cleanup();
  await prisma.$disconnect();
});

describe("portal sign-in", () => {
  it("1. student signs in on the student login and gets a Neon Auth session", async () => {
    const b = browser();
    const r = await authenticate("student", student.username, PASSWORD, b.signIn);
    expect(r).toMatchObject({ ok: true, user: { id: student.id } });
    expect([...b.jar.keys()]).toContain("__Secure-neon-auth.session_token");
    const { data } = await b.client.getSession();
    expect(data?.user?.id).toBe(student.neonAuthUserId);
  });

  it("2. staff signs in on the staff login", async () => {
    expect(await authenticate("staff", staff.username, PASSWORD, browser().signIn)).toMatchObject({ ok: true, user: { id: staff.id } });
  });

  it("3. admin signs in on the staff login (also by email)", async () => {
    expect(await authenticate("staff", admin.email, PASSWORD, browser().signIn)).toMatchObject({ ok: true, user: { id: admin.id } });
  });

  it("4. a student on the admin/staff login is refused before Neon Auth is even asked", async () => {
    const signIn = vi.fn<NeonSignIn>();
    expect(await authenticate("staff", student.username, PASSWORD, signIn)).toEqual({ ok: false, reason: "invalid" });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("5. staff and admins on the student login are refused before Neon Auth is asked", async () => {
    const signIn = vi.fn<NeonSignIn>();
    expect(await authenticate("student", staff.username, PASSWORD, signIn)).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate("student", admin.username, PASSWORD, signIn)).toEqual({ ok: false, reason: "invalid" });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("6. a deactivated user is refused even though their identity is still valid", async () => {
    const signIn = vi.fn<NeonSignIn>();
    expect(await authenticate("student", deactivated.username, PASSWORD, signIn)).toEqual({ ok: false, reason: "invalid" });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("rejects a wrong password (Neon Auth says no) and unknown users", async () => {
    expect(await authenticate("student", student.username, "wrong-password", browser().signIn)).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate("student", `${tag}_nobody`, PASSWORD, browser().signIn)).toEqual({ ok: false, reason: "invalid" });
  });

  it("an account not yet linked to Neon Auth cannot sign in", async () => {
    expect(await authenticate("student", legacy.username, PASSWORD, browser().signIn)).toEqual({ ok: false, reason: "invalid" });
  });

  it("if Neon Auth authenticates a different identity than the linked one, the session is discarded", async () => {
    const onMismatch = vi.fn(async () => {});
    const r = await authenticate("student", student.username, PASSWORD, async () => ({ userId: "someone-else" }), onMismatch);
    expect(r).toEqual({ ok: false, reason: "invalid" });
    expect(onMismatch).toHaveBeenCalledOnce();
  });

  it("locks a handle after repeated failures, even with the right password", async () => {
    const victim = await linkedUser("auth_throttle", "STUDENT");
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      expect((await authenticate("student", victim.username, "wrong", browser().signIn)).ok).toBe(false);
    }
    expect(await authenticate("student", victim.username, PASSWORD, browser().signIn)).toEqual({ ok: false, reason: "throttled" });
    await ids.remove(victim.neonAuthUserId!);
  });
});

describe("sessions", () => {
  it("10. sign-out ends the session", async () => {
    const b = browser();
    await authenticate("student", student.username, PASSWORD, b.signIn);
    await b.client.signOut();
    expect([...b.jar.keys()]).not.toContain("__Secure-neon-auth.session_token");
    expect((await b.client.getSession()).data?.user ?? null).toBeNull();
  });

  it("11. an invalid or forged session token yields no identity", async () => {
    const b = browser();
    b.jar.set("__Secure-neon-auth.session_token", "forged.token.value");
    expect((await b.client.getSession()).data?.user ?? null).toBeNull();
    // A forged session_data cookie (not signed with NEON_AUTH_COOKIE_SECRET) is not trusted either.
    b.jar.set("__Secure-neon-auth.local.session_data", "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjp7ImlkIjoiYWRtaW4ifX0.bad");
    expect((await b.client.getSession()).data?.user ?? null).toBeNull();
  });

  it("11. a revoked session (password reset by an admin) stops working", async () => {
    const b = browser();
    await authenticate("student", student.username, PASSWORD, b.signIn);
    await ids.setPassword(student.neonAuthUserId!, "a-brand-new-pass");
    const res = await b.client.getSession({ query: { disableCookieCache: "true" } });
    expect(res.data?.user ?? null).toBeNull();
    expect(await authenticate("student", student.username, PASSWORD, browser().signIn)).toMatchObject({ ok: false });
    expect(await authenticate("student", student.username, "a-brand-new-pass", browser().signIn)).toMatchObject({ ok: true });
    await ids.setPassword(student.neonAuthUserId!, PASSWORD);
  });
});

describe("identity provisioning", () => {
  it("disabling an identity blocks Neon Auth sign-in and ends sessions; enabling restores it", async () => {
    const u = await linkedUser("auth_ban", "STUDENT");
    const b = browser();
    expect((await authenticate("student", u.username, PASSWORD, b.signIn)).ok).toBe(true);
    await ids.disable(u.neonAuthUserId!);
    expect((await b.client.getSession({ query: { disableCookieCache: "true" } })).data?.user ?? null).toBeNull();
    expect(await browser().signIn(u.email!, PASSWORD)).toBeNull();
    await ids.enable(u.neonAuthUserId!);
    expect(await browser().signIn(u.email!, PASSWORD)).toMatchObject({ userId: u.neonAuthUserId });
    await ids.remove(u.neonAuthUserId!);
  });

  it("refuses to create a second identity for an existing email", async () => {
    await expect(ids.createIdentity({ email: student.email!, password: PASSWORD, name: "Dup" })).rejects.toThrow(/already exists/);
  });

  it("the provisioner is the only Neon Auth admin: ordinary users can't call the admin API", async () => {
    const b = browser();
    await b.signIn(student.email!, PASSWORD);
    const res = await b.client.admin.listUsers({ query: {} });
    expect(res.error?.status).toBe(403);
  });
});
