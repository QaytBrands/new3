import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authConfig } from "./config";

const DUMMY_HASH = bcrypt.hashSync("timing-equaliser", 10);

async function verify(credentials: Partial<Record<string, unknown>>, roles: Role[]) {
  const username = String(credentials.username ?? "").trim().toLowerCase();
  const password = String(credentials.password ?? "");
  if (!username || !password) return null;
  const user = await prisma.user.findUnique({ where: { username } });
  // Always run bcrypt to keep timing similar whether or not the user exists.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active || !roles.includes(user.role)) {
    throw new CredentialsSignin();
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  return { id: user.id, name: user.name, role: user.role };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "student",
      name: "Student",
      credentials: { username: {}, password: {} },
      authorize: (c) => verify(c, ["STUDENT"]),
    }),
    Credentials({
      id: "staff",
      name: "Admin & staff",
      credentials: { username: {}, password: {} },
      authorize: (c) => verify(c, ["ADMIN", "STAFF"]),
    }),
  ],
});
