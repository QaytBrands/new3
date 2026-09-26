import { requireStaff } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/time";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { TimeZoneSelect } from "@/components/admin/TimeZoneSelect";
import { changeOwnPassword, updateOwnTimezone } from "@/server/admin/users";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireStaff();
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-bold">My account</h1>
      <section className="card p-4">
        <p className="text-sm text-slate-600">{user.name} (@{user.username}) · {user.role === "ADMIN" ? "Admin" : "Staff"}</p>
        <p className="mt-1 text-sm text-slate-500">Your local time now: {formatDateTime(new Date(), user.timezone)}</p>
        <ActionForm action={updateOwnTimezone} className="mt-4">
          <Field label="Time zone" hint="Dashboard “today” metrics and all dates you see use this zone."><TimeZoneSelect defaultValue={user.timezone} /></Field>
        </ActionForm>
      </section>
      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Change password</h2>
        <ActionForm action={changeOwnPassword} submitLabel="Change password" resetOnSuccess>
          <Field label="Current password"><input className="input" name="currentPassword" type="password" autoComplete="current-password" required /></Field>
          <Field label="New password" hint="At least 8 characters"><input className="input" name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></Field>
          <Field label="Confirm new password"><input className="input" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></Field>
        </ActionForm>
      </section>
    </div>
  );
}
