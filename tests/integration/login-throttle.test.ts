import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { LOGIN_MAX_FAILURES, verifyCredentials } from "@/lib/auth";
import { cleanup, makeUser } from "./setup";

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("credential verification", () => {
  it("rejects students on the staff provider and staff on the student provider", async () => {
    const s = await makeUser("roles_student", "STUDENT");
    const t = await makeUser("roles_staff", "STAFF");
    await expect(verifyCredentials({ username: s.username, password: "correct-horse" }, ["ADMIN", "STAFF"])).rejects.toThrow();
    await expect(verifyCredentials({ username: t.username, password: "correct-horse" }, ["STUDENT"])).rejects.toThrow();
    await expect(verifyCredentials({ username: s.username, password: "correct-horse" }, ["STUDENT"])).resolves.toMatchObject({ id: s.id });
  });

  it("rejects deactivated accounts", async () => {
    const u = await makeUser("roles_off", "STUDENT", { active: false });
    await expect(verifyCredentials({ username: u.username, password: "correct-horse" }, ["STUDENT"])).rejects.toThrow();
  });

  it("locks an account after repeated failures, even with the right password", async () => {
    const u = await makeUser("throttle", "STUDENT");
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await expect(verifyCredentials({ username: u.username, password: "wrong" }, ["STUDENT"])).rejects.toThrow();
    }
    await expect(verifyCredentials({ username: u.username, password: "correct-horse" }, ["STUDENT"])).rejects.toThrow();
  });
});
