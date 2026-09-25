import { prisma } from "@/lib/db";
import { requirePageAdmin } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/permissions";
import { ActionForm, Checkbox, Field } from "@/components/admin/ActionForm";
import { createStaff, updateStaff } from "@/server/admin/users";
import { TimeZoneSelect } from "@/components/admin/TimeZoneSelect";

export const metadata = { title: "Staff" };

function PermissionBoxes({ granted = [] }: { granted?: string[] }) {
  return (
    <fieldset>
      <legend className="label">Permissions</legend>
      <div className="grid gap-1 sm:grid-cols-3">
        {PERMISSIONS.map((p) => <Checkbox key={p.value} name="permissions" value={p.value} label={p.label} defaultChecked={granted.includes(p.value)} />)}
      </div>
    </fieldset>
  );
}

export default async function StaffPage() {
  await requirePageAdmin();
  const staff = await prisma.user.findMany({ where: { role: "STAFF" }, orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Staff</h1>
      <p className="text-sm text-slate-500">Staff only have the permissions ticked below. Admin-only actions (deleting students, resetting progress, staff and settings) can’t be delegated.</p>

      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">+ New staff member</summary>
        <ActionForm action={createStaff} submitLabel="Create staff account" resetOnSuccess className="mt-4">
          <div className="grid gap-3 sm:grid-cols-5">
            <Field label="Name"><input className="input" name="name" required /></Field>
            <Field label="Username"><input className="input" name="username" required autoCapitalize="none" /></Field>
            <Field label="Email"><input className="input" name="email" type="email" /></Field>
            <Field label="Password"><input className="input" name="password" type="text" required minLength={8} /></Field>
            <Field label="Time zone"><TimeZoneSelect /></Field>
          </div>
          <PermissionBoxes />
        </ActionForm>
      </details>

      {staff.map((s) => (
        <section key={s.id} className="card p-4">
          <h2 className="mb-3 font-semibold">{s.name} <span className="font-normal text-slate-500">@{s.username}</span>{!s.active && <span className="ml-2 text-sm text-rose-600">disabled</span>}</h2>
          <ActionForm action={updateStaff}>
            <input type="hidden" name="id" value={s.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name"><input className="input" name="name" defaultValue={s.name} required /></Field>
              <Field label="Email"><input className="input" name="email" type="email" defaultValue={s.email ?? ""} /></Field>
              <Field label="New password" hint="Leave blank to keep"><input className="input" name="password" type="text" minLength={8} /></Field>
              <Field label="Time zone"><TimeZoneSelect defaultValue={s.timezone} /></Field>
            </div>
            <PermissionBoxes granted={s.permissions} />
            <Checkbox name="active" label="Account active" defaultChecked={s.active} />
          </ActionForm>
        </section>
      ))}
      {staff.length === 0 && <p className="text-sm text-slate-500">No staff yet.</p>}
    </div>
  );
}
