import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { getAdminStats } from "@/server/admin-data";

export const metadata = { title: "Admin dashboard" };

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default async function AdminDashboard() {
  const user = await requireStaff();
  if (!hasPermission(user, "VIEW_PROGRESS")) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-bold">Welcome, {user.name}</h1>
        <div className="grid gap-2 sm:grid-cols-3">
          {ADMIN_NAV.filter((i) => i.href !== "/admin" && i.show(user)).map((i) => (
            <Link key={i.href} href={i.href} className="card p-4 font-medium hover:bg-slate-50">{i.label} →</Link>
          ))}
        </div>
      </div>
    );
  }
  const s = await getAdminStats();
  const maxDay = Math.max(1, ...s.pronunciation.byDay.map(([, n]) => n));
  const canViewStudents = hasPermission(user, "VIEW_STUDENTS");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total students" value={s.totalStudents} />
        <Stat label="Active students" value={s.activeStudents} sub="signed in within 7 days" />
        <Stat label="Lessons completed today" value={s.lessonsCompletedToday} />
        <Stat label="Tests completed" value={s.testsCompleted} sub={`${s.testsCompletedToday} today`} />
        <Stat label="Average test score" value={s.averageScore != null ? `${Math.round(s.averageScore)}%` : "—"} sub="last 30 days" />
        <Stat label="Vocabulary completion" value={`${Math.round(s.vocabularyCompletion * 100)}%`} sub={`${s.wordsSeen} of ${s.wordsAssigned} unlocked words seen`} />
        <Stat label="Pronunciation attempts" value={s.pronunciation.total} sub={`${s.pronunciation.students} students, last 7 days`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Students requiring attention</h2>
          {s.attention.length === 0 ? (
            <p className="text-sm text-slate-500">No one right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {s.attention.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2">
                  {canViewStudents ? <Link href={`/admin/students/${a.id}`} className="font-medium text-brand-700">{a.name}</Link> : <span className="font-medium">{a.name}</span>}
                  <span className="text-right text-slate-500">{a.reasons.join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Pronunciation activity (7 days)</h2>
          <div className="flex h-32 items-end gap-2">
            {s.pronunciation.byDay.map(([day, n]) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500">{n}</span>
                <div className="w-full rounded-t bg-brand-500" style={{ height: `${(n / maxDay) * 90 + 2}px` }} />
                <span className="text-[10px] text-slate-400">{day.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
