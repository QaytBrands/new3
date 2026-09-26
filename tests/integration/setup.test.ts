/**
 * First-time setup (/setup) against a fresh, empty, migrated database — the state of a new
 * production deployment — and the local Neon Auth stand-in.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execSync } from "node:child_process";

// Point this file at its own database before any module creates a Prisma client.
const urls = vi.hoisted(() => {
  const base = process.env.DATABASE_URL!;
  const fresh = base.replace(/\/([^/?]+)(\?|$)/, "/vocab_setup_it$2");
  process.env.DATABASE_URL = fresh;
  process.env.DIRECT_URL = fresh;
  return { base, fresh };
});

import { prisma } from "@/lib/db";
import { createIdentityAdmin } from "@/lib/auth/provisioning";
import { isSetupComplete, runFirstTimeSetup, SETUP_MAX_FAILURES } from "@/lib/setup";

const KEY = process.env.AUTH_PROVISIONER_PASSWORD!;
const ids = () => createIdentityAdmin();
const good = { setupKey: KEY, name: "School Owner", email: `owner.${Date.now()}@setup.test`, password: "owner-pass-1", loadSample: true };

beforeAll(() => {
  const admin = urls.base.replace(/\/([^/?]+)(\?|$)/, "/postgres$2");
  execSync(`psql "${admin}" -qc "DROP DATABASE IF EXISTS vocab_setup_it" -c "CREATE DATABASE vocab_setup_it"`, { stdio: "pipe" });
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: urls.fresh, DIRECT_URL: urls.fresh }, stdio: "pipe" });
}, 120_000);

afterAll(async () => {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (admin?.neonAuthUserId) await ids().remove(admin.neonAuthUserId).catch(() => {});
  await prisma.$disconnect();
});

describe("first-time setup", () => {
  it("is open on a fresh database", async () => {
    expect(await isSetupComplete()).toBe(false);
  });

  it("rejects a wrong setup key and records the failure", async () => {
    expect(await runFirstTimeSetup({ ...good, setupKey: "wrong" }, ids)).toEqual({ ok: false, error: "The setup key is not correct." });
    expect(await prisma.auditLog.count({ where: { action: "setup.failed" } })).toBe(1);
    expect(await isSetupComplete()).toBe(false);
  });

  it("throttles repeated wrong keys, even when the right key follows", async () => {
    for (let i = 1; i < SETUP_MAX_FAILURES; i++) await runFirstTimeSetup({ ...good, setupKey: `wrong-${i}` }, ids);
    expect(await runFirstTimeSetup(good, ids)).toEqual({ ok: false, error: "Too many attempts. Try again in 15 minutes." });
    await prisma.auditLog.deleteMany({ where: { action: "setup.failed" } }); // window passes
  });

  it("validates the admin details", async () => {
    const res = await runFirstTimeSetup({ ...good, password: "short" }, ids);
    expect(res.ok).toBe(false);
    expect(await isSetupComplete()).toBe(false);
  });

  it("creates the first admin linked to a Neon Auth identity, plus the sample course", async () => {
    expect(await runFirstTimeSetup(good, ids)).toEqual({ ok: true });
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
    expect(admin).toMatchObject({ role: "ADMIN", email: good.email, active: true });
    expect(admin.neonAuthUserId).toBeTruthy();
    expect(admin.passwordHash).toBeNull();
    const identity = await ids().findIdentityByEmail(good.email);
    expect(identity?.id).toBe(admin.neonAuthUserId);
    expect(await prisma.level.count({ where: { code: "A1" } })).toBe(1);
    expect(await prisma.vocabulary.count()).toBeGreaterThan(30);
    expect(await prisma.test.count()).toBeGreaterThan(0);
  });

  it("can't be run a second time — not even with the right key", async () => {
    expect(await runFirstTimeSetup({ ...good, email: "attacker@setup.test" }, ids)).toEqual({ ok: false, error: "Setup has already been completed." });
    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
  });
});
