import type { NextAuthConfig } from "next-auth";

/** Edge-safe config (no Prisma / bcrypt) shared by middleware and the full auth instance. */
export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as "ADMIN" | "STAFF" | "STUDENT";
      return session;
    },
  },
} satisfies NextAuthConfig;
