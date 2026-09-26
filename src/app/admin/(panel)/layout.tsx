import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { logout } from "@/server/auth-actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const nav = ADMIN_NAV.filter((i) => i.show(user));
  return (
    <div className="min-h-dvh bg-slate-100 md:flex">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-3 md:block">
          <Link href="/admin" className="font-bold">Wortweg Admin</Link>
          <p className="text-xs text-slate-500 md:mt-1">{user.name} · {user.role === "ADMIN" ? "Admin" : "Staff"}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {nav.map((i) => (
            <Link key={i.href} href={i.href} className="shrink-0 rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">{i.label}</Link>
          ))}
          <form action={logout} className="md:mt-4">
            <input type="hidden" name="to" value="/admin/login" />
            <button className="shrink-0 rounded-md px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-100">Sign out</button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
