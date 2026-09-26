import { requirePagePermission } from "@/lib/auth/guards";
import { CSV_COLUMNS } from "@/lib/validation";
import { ImportForm } from "@/components/admin/ImportForm";

export const metadata = { title: "Import vocabulary" };

export default async function ImportPage() {
  await requirePagePermission("MANAGE_VOCABULARY");
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-bold">Import vocabulary (CSV)</h1>
      <section className="card space-y-2 p-4 text-sm">
        <p>Upload a UTF-8 CSV with a header row. Columns:</p>
        <code className="block overflow-x-auto rounded bg-slate-100 p-2 text-xs">{CSV_COLUMNS.join(",")}</code>
        <ul className="list-disc pl-5 text-slate-600">
          <li><b>level</b> must be an existing level code (e.g. A1). <b>chapter</b> is matched by title; <b>day</b> by number. Missing chapters/days are created if you can manage chapters.</li>
          <li><b>article</b>: der, die, das or empty. <b>tags</b>: separated by “;”. <b>difficulty</b>: 1–5.</li>
          <li>Multiple example sentences: separate with “|” in both <b>example_de</b> and <b>example_en</b>.</li>
          <li>Words that already exist in the same day are skipped. Nothing is written until you confirm, and the import is all-or-nothing.</li>
        </ul>
        <a className="text-brand-700 underline" href="/vocabulary-template.csv" download>Download a template</a>
      </section>
      <section className="card p-4">
        <ImportForm />
      </section>
    </div>
  );
}
