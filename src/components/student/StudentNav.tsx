"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const items = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/levels", label: "Learn", icon: "📚" },
  { href: "/words", label: "Words", icon: "🔤" },
  { href: "/progress", label: "Progress", icon: "📈" },
];

export function StudentNav({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/") || (href === "/levels" && /^\/(chapters|lessons|tests|attempts)/.test(path));
  if (variant === "top") {
    return (
      <nav className="hidden gap-1 sm:flex">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={clsx("rounded-lg px-3 py-2 text-sm font-medium", active(i.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100")}>
            {i.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={clsx("flex flex-col items-center py-2 text-[11px] font-medium", active(i.href) ? "text-brand-600" : "text-slate-500")}>
          <span className="text-lg" aria-hidden>{i.icon}</span>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
