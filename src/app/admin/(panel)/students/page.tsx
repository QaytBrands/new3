import { formatDate } from "@/lib/time";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { createStudent } from "@/server/admin/users";
import { TimeZoneSelect } from "@/components/admin/TimeZoneSelect";

export const metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePagePermission("VIEW_STUDENTS");
  const { q = "" } = await searchParams;
  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { lessonProgress: { where: { status: "COMPLETED" } }, testAttempts: { where: { completedAt: { not: null } } } } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Students</h1>
        <form className="flex gap-2">
          <input className="input w-56" name="q" placeholder="Search name or username" defaultValue={q} />
          <button className="btn-secondary">Search</button>
        </form>
      </div>

      {hasPermission(user, "CREATE_STUDENTS") && (
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold">+ New student</summary>
          <ActionForm action={createStudent} submitLabel="Create student" resetOnSuccess className="mt-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Name"><input className="input" name="name" required /></Field>
              <Field label="Username"><input className="input" name="username" required autoCapitalize="none" /></Field>
              <Field label="Email (optional)"><input className="input" name="email" type="email" /></Field>
              <Field label="Initial password"><input className="input" name="password" type="text" required minLength={8} /></Field>
              <Field label="Time zone" hint="Defines the student's “today”"><TimeZoneSelect /></Field>
            </div>
          </ActionForm>
        </details>
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Username</th><th>Status</th><th>Lessons done</th><th>Tests</th><th>Last active</th></tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td><Link className="font-medium text-brand-700" href={`/admin/students/${s.id}`}>{s.name}</Link></td>
                <td className="text-slate-500">{s.username}</td>
                <td>{s.active ? "Active" : <span className="text-rose-600">Disabled</span>}</td>
                <td>{s._count.lessonProgress}</td>
                <td>{s._count.testAttempts}</td>
                <td className="text-slate-500">{s.lastActiveAt ? formatDate(s.lastActiveAt, user.timezone) : "never"}</td>
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan={6} className="text-slate-500">No students found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
