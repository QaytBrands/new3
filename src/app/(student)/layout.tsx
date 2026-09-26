import Link from "next/link";
import { requireStudent } from "@/lib/auth/guards";
import { StudentNav } from "@/components/student/StudentNav";
import { logout } from "@/server/auth-actions";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">W</span>
            <span className="hidden sm:inline">Wortweg</span>
          </Link>
          <StudentNav variant="top" />
          <form action={logout} className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 md:inline">{user.name}</span>
            <button className="text-sm text-slate-500 hover:text-slate-800">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:pb-10">{children}</main>
      <StudentNav variant="bottom" />
    </div>
  );
}
