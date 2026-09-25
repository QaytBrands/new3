import Link from "next/link";
import { LoginForm } from "@/components/ui/LoginForm";
import { studentLogin } from "@/server/auth-actions";

export const metadata = { title: "Sign in" };

export default function StudentLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">W</div>
          <h1 className="text-2xl font-bold">Willkommen!</h1>
          <p className="text-slate-500">Sign in to continue learning German.</p>
        </div>
        <div className="card p-6">
          <LoginForm action={studentLogin} submitLabel="Sign in" />
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Staff member? <Link href="/admin/login" className="underline">Staff sign-in</Link>
        </p>
      </div>
    </main>
  );
}
