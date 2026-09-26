"use client";

import { useActionState } from "react";
import type { LoginState } from "@/server/auth-actions";

export function LoginForm({
  action,
  submitLabel,
}: {
  action: (s: LoginState, f: FormData) => Promise<LoginState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input className="input py-3 text-base" id="username" name="username" autoComplete="username" autoCapitalize="none" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input py-3 text-base" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      <button className="btn-primary btn-lg w-full" disabled={pending}>{pending ? "Signing in…" : submitLabel}</button>
    </form>
  );
}
