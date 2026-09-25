import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="max-w-md">
      <h1 className="text-xl font-bold">Access denied</h1>
      <p className="mt-2 text-slate-600">Your account doesn’t have permission to view this page. Ask an administrator if you need access.</p>
      <Link href="/admin" className="btn-secondary mt-4">Back to dashboard</Link>
    </div>
  );
}
