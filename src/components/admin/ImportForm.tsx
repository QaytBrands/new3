"use client";

import { startTransition, useActionState } from "react";
import { importVocabulary, type ImportState } from "@/server/admin/import";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importVocabulary, {});
  const p = state.preview;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => action(fd));
      }}
    >
      <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm" />
      <div className="flex gap-2">
        <button className="btn-secondary" name="intent" value="preview" disabled={pending}>Preview</button>
        {p && p.errors.length === 0 && p.toCreate > 0 && !state.committed && (
          <button className="btn-primary" name="intent" value="commit" disabled={pending}>Import {p.toCreate} words</button>
        )}
      </div>
      {pending && <p className="text-sm text-slate-500">Working…</p>}
      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {state.committed && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Imported {p?.toCreate} words.</p>}
      {p && (
        <div className="space-y-3 text-sm">
          <p><b>{p.toCreate}</b> words ready · <b>{p.skipped.length}</b> duplicates skipped · <b className={p.errors.length ? "text-rose-600" : ""}>{p.errors.length}</b> errors</p>
          {p.newChapters.length > 0 && <p>New chapters: {p.newChapters.join(", ")}</p>}
          {p.newLessons.length > 0 && <p>New days: {p.newLessons.join("; ")}</p>}
          {p.errors.length > 0 && (
            <ul className="max-h-60 overflow-auto rounded-lg bg-rose-50 p-3 text-rose-800">
              {p.errors.map((e) => <li key={e.line}>Line {e.line}: {e.messages.join("; ")}</li>)}
            </ul>
          )}
          {p.skipped.length > 0 && (
            <ul className="max-h-40 overflow-auto rounded-lg bg-amber-50 p-3 text-amber-800">
              {p.skipped.map((e) => <li key={e.line}>Line {e.line}: {e.reason}</li>)}
            </ul>
          )}
          {p.sample.length > 0 && (
            <table className="table">
              <thead><tr><th>Line</th><th>Level</th><th>Chapter</th><th>Day</th><th>German</th><th>English</th></tr></thead>
              <tbody>
                {p.sample.map((r) => (
                  <tr key={r.line}><td>{r.line}</td><td>{r.level}</td><td>{r.chapter}</td><td>{r.day}</td><td>{r.article?.toLowerCase()} {r.german}</td><td>{r.english}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </form>
  );
}
