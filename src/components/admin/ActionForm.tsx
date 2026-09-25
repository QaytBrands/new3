"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import clsx from "clsx";
import type { FormState } from "@/server/admin/common";

type Action = (s: FormState, fd: FormData) => Promise<FormState>;

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className,
  confirm,
  resetOnSuccess = false,
  variant = "primary",
  inline = false,
}: {
  action: Action;
  children?: React.ReactNode;
  submitLabel?: string;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  variant?: "primary" | "secondary" | "danger";
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={clsx(inline ? "inline-flex items-center gap-2" : "space-y-3", className)}
      onSubmit={(e) => {
        // Submit manually so React doesn't auto-reset the form (keeps input on validation errors).
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {children}
      <div className={clsx("flex items-center gap-3", inline && "contents")}>
        <button className={variant === "danger" ? "btn-danger" : variant === "secondary" ? "btn-secondary" : "btn-primary"} disabled={pending}>
          {pending ? "Working…" : submitLabel}
        </button>
        {!inline && state.error && <p role="alert" className="text-sm text-rose-600">{state.error}</p>}
        {!inline && state.ok && state.message && <p className="text-sm text-emerald-600">{state.message}</p>}
      </div>
      {inline && state.error && <span role="alert" className="text-xs text-rose-600">{state.error}</span>}
    </form>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Checkbox({ name, label, defaultChecked, value }: { name: string; label: string; defaultChecked?: boolean; value?: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-slate-300" />
      {label}
    </label>
  );
}
