import Link from "next/link";
import { isSetupComplete } from "@/lib/setup";
import { SetupForm } from "@/components/ui/SetupForm";

export const metadata = { title: "First-time setup" };
export const dynamic = "force-dynamic";

/** Which settings are present (never their values). */
function configChecklist() {
  const env = process.env;
  return [
    { name: "DATABASE_URL", ok: !!env.DATABASE_URL },
    { name: "DIRECT_URL", ok: !!env.DIRECT_URL },
    { name: "NEON_AUTH_BASE_URL", ok: !!env.NEON_AUTH_BASE_URL },
    { name: "NEON_AUTH_COOKIE_SECRET (32+ characters)", ok: (env.NEON_AUTH_COOKIE_SECRET ?? "").length >= 32 },
    { name: "AUTH_PROVISIONER_EMAIL", ok: !!env.AUTH_PROVISIONER_EMAIL },
    { name: "AUTH_PROVISIONER_PASSWORD", ok: !!env.AUTH_PROVISIONER_PASSWORD },
  ];
}

export default async function SetupPage() {
  const done = await isSetupComplete();
  const checks = configChecklist();
  const ready = checks.every((c) => c.ok);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold">Wortweg — first-time setup</h1>
        {done ? (
          <div className="card p-6">
            <p>Setup is already complete.</p>
            <Link href="/admin/login" className="btn-primary mt-4">Go to admin sign-in</Link>
          </div>
        ) : (
          <>
            <div className="card p-4 text-sm">
              <p className="mb-2 font-semibold">Vercel settings</p>
              <ul className="space-y-1">
                {checks.map((c) => (
                  <li key={c.name} className={c.ok ? "text-emerald-700" : "text-rose-700"}>{c.ok ? "✓" : "✗ missing:"} {c.name}</li>
                ))}
              </ul>
              {!ready && <p className="mt-2 text-slate-600">Add the missing settings in Vercel → Settings → Environment Variables, then redeploy.</p>}
            </div>
            {ready && (
              <div className="card p-6">
                <p className="mb-4 text-sm text-slate-600">Create the first administrator. This page stops working once an admin exists.</p>
                <SetupForm />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
