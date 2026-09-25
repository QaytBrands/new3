"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";

export type LoginState = { error?: string };

async function login(provider: "student" | "staff", redirectTo: string, formData: FormData): Promise<LoginState> {
  try {
    await signIn(provider, {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo,
    });
    return {};
  } catch (e) {
    if (e instanceof AuthError) return { error: "Incorrect username or password." };
    throw e;
  }
}

export async function studentLogin(_: LoginState, formData: FormData) {
  return login("student", "/dashboard", formData);
}

export async function staffLogin(_: LoginState, formData: FormData) {
  return login("staff", "/admin", formData);
}

export async function logout(formData: FormData) {
  const to = formData.get("to") === "/admin/login" ? "/admin/login" : "/login";
  await signOut({ redirectTo: to });
}
