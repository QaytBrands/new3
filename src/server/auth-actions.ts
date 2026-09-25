"use server";

import { redirect } from "next/navigation";
import { authenticate, type Portal } from "@/lib/auth/login";
import { clearNeonAuthCookies, neonAuth } from "@/lib/auth/neon-server";
import { isNeonAuthConfigured } from "@/lib/auth/neon-config";

export type LoginState = { error?: string };

const GENERIC_ERROR = "Incorrect username or password.";

async function login(portal: Portal, redirectTo: string, formData: FormData): Promise<LoginState> {
  if (!isNeonAuthConfigured()) return { error: "Sign-in is not configured on this server." };
  const result = await authenticate(
    portal,
    formData.get("username"),
    formData.get("password"),
    async (email, password) => {
      const { data, error } = await neonAuth().signIn.email({ email, password });
      return error || !data?.user?.id ? null : { userId: data.user.id };
    },
    async () => {
      await neonAuth().signOut().catch(() => undefined);
      await clearNeonAuthCookies();
    },
  );
  // Same message for every failure (wrong password, wrong portal, deactivated, locked out).
  if (!result.ok) return { error: GENERIC_ERROR };
  redirect(redirectTo);
}

export async function studentLogin(_: LoginState, formData: FormData) {
  return login("student", "/dashboard", formData);
}

export async function staffLogin(_: LoginState, formData: FormData) {
  return login("staff", "/admin", formData);
}

export async function logout(formData: FormData) {
  const to = formData.get("to") === "/admin/login" ? "/admin/login" : "/login";
  if (isNeonAuthConfigured()) await neonAuth().signOut().catch(() => undefined);
  await clearNeonAuthCookies();
  redirect(to);
}
