"use client";

import { useState, useTransition } from "react";
import { startTest } from "@/server/test-actions";

export function StartTestButton({ testId, label }: { testId: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="btn-primary btn-lg w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await startTest(testId);
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? "Preparing…" : label}
      </button>
      {error && <p className="mt-2 text-center text-sm text-rose-600">{error}</p>}
    </div>
  );
}
