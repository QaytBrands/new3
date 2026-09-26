import { Field } from "./ActionForm";

/**
 * Sign-in email on edit forms. Once an account is linked to a Neon Auth identity its email is the
 * login identifier and is shown read-only; unlinked (pre-Neon Auth) accounts can still set one.
 */
export function SignInEmailField({ email, linked }: { email: string | null; linked: boolean }) {
  if (linked) {
    return (
      <Field label="Sign-in email" hint="Linked to Neon Auth">
        <input className="input bg-slate-50" value={email ?? ""} readOnly aria-readonly />
      </Field>
    );
  }
  return (
    <Field label="Sign-in email" hint="Not linked yet: set an email and a password to create the sign-in account">
      <input className="input" name="email" type="email" defaultValue={email ?? ""} />
    </Field>
  );
}

export function LinkBadge({ linked }: { linked: boolean }) {
  return linked ? null : (
    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800" title="No Neon Auth sign-in account yet; set a password to create one">
      cannot sign in yet
    </span>
  );
}
