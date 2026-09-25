import { requireStaff } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/time";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { TimeZoneSelect } from "@/components/admin/TimeZoneSelect";
import { updateOwnTimezone } from "@/server/admin/users";

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
    </div>
  );
}
