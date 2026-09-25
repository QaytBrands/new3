import { LoginForm } from "@/components/ui/LoginForm";
import { staffLogin } from "@/server/auth-actions";

export const metadata = { title: "Staff sign in" };

export default function StaffLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-bold">Wortweg Admin</h1>
        <p className="mb-6 text-sm text-slate-500">Administrator and staff access</p>
        <div className="card p-6">
          <LoginForm action={staffLogin} submitLabel="Sign in" />
        </div>
      </div>
    </main>
  );
}
