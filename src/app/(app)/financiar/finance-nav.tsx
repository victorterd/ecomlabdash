"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/financiar", label: "Prezentare" },
  { href: "/financiar/tranzactii", label: "Tranzacții" },
  { href: "/financiar/plati", label: "Plăți de făcut" },
  { href: "/financiar/categorii", label: "Pe categorii" },
  { href: "/financiar/forecast", label: "Forecast" },
  { href: "/financiar/recurente", label: "Recurente" },
];

export function FinanceNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-3 mb-5 flex gap-1 overflow-x-auto border-b px-3 sm:mx-0 sm:px-0">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground",
            pathname === item.href && "border-brand text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
