import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "STAFF" | "STUDENT";
  }
  interface Session {
    user: { id: string; role: "ADMIN" | "STAFF" | "STUDENT" } & DefaultSession["user"];
  }
}
