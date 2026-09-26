import type { Article } from "@prisma/client";
import clsx from "clsx";

export function articleColor(article: Article | null | undefined) {
  return article === "DER" ? "text-der" : article === "DIE" ? "text-die" : article === "DAS" ? "text-das" : "text-slate-900";
}

export function GermanWord({ german, article, className }: { german: string; article: Article | null; className?: string }) {
  return (
    <span className={className}>
      {article && <span className={clsx("mr-2 font-semibold", articleColor(article))}>{article.toLowerCase()}</span>}
      <span>{german}</span>
    </span>
  );
}
