import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authConfig } from "./config";

const DUMMY_HASH = bcrypt.hashSync("timing-equaliser", 10);

/** Failed sign-ins per username allowed within the window before further attempts are refused. */
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

async function recentFailures(username: string) {
  return prisma.auditLog.count({
    where: { action: "auth.failed", target: username, createdAt: { gte: new Date(Date.now() - LOGIN_WINDOW_MS) } },
  });
}

/** Exported for tests; used by both credential providers. */
export async function verifyCredentials(credentials: Partial<Record<string, unknown>>, roles: Role[]) {
  const username = String(credentials.username ?? "").trim().toLowerCase().slice(0, 64);
  const password = String(credentials.password ?? "").slice(0, 200);
  if (!username || !password) return null;
  // Throttle password guessing per account. Stored in the DB so it holds across serverless instances.
  if ((await recentFailures(username)) >= LOGIN_MAX_FAILURES) throw new CredentialsSignin();
  const user = await prisma.user.findUnique({ where: { username } });
  // Always run bcrypt to keep timing similar whether or not the user exists.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active || !roles.includes(user.role)) {
    await prisma.auditLog.create({ data: { action: "auth.failed", target: username } });
    throw new CredentialsSignin();
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  return { id: user.id, name: user.name, role: user.role };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // A wrong password is expected, not a server error.
    error(error) {
      if ((error as { type?: string }).type !== "CredentialsSignin") console.error(error);
    },
  },
  providers: [
    Credentials({
      id: "student",
      name: "Student",
      credentials: { username: {}, password: {} },
      authorize: (c) => verifyCredentials(c, ["STUDENT"]),
    }),
    Credentials({
      id: "staff",
      name: "Admin & staff",
      credentials: { username: {}, password: {} },
      authorize: (c) => verifyCredentials(c, ["ADMIN", "STAFF"]),
    }),
  ],
});
