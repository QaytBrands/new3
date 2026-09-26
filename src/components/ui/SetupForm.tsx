"use client";

import { startTransition, useActionState } from "react";
import { completeSetup, type SetupState } from "@/server/setup-actions";

export function SetupForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(completeSetup, {});
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <div>
        <label className="label" htmlFor="setupKey">Setup key</label>
        <input className="input" id="setupKey" name="setupKey" type="password" required autoComplete="off" />
        <p className="mt-1 text-xs text-slate-500">The value of AUTH_PROVISIONER_PASSWORD you entered in Vercel.</p>
      </div>
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input className="input" id="name" name="name" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Your email (you sign in with this or the username “admin”)</label>
        <input className="input" id="email" name="email" type="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Choose a password</label>
        <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="loadSample" defaultChecked className="h-4 w-4" /> Load the sample A1 course
      </label>
      {state.error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Setting up…" : "Create admin account"}</button>
    </form>
  );
}
