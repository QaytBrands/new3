import clsx from "clsx";

export function ProgressBar({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "green" | "amber" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={clsx("h-2 w-full overflow-hidden rounded-full bg-slate-200", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={clsx("h-full rounded-full transition-all", {
          "bg-brand-500": tone === "brand",
          "bg-emerald-500": tone === "green",
          "bg-amber-500": tone === "amber",
        })}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
