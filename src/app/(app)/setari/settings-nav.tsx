"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/setari", label: "General" },
  { href: "/setari/lead-uri", label: "Lead-uri" },
  { href: "/setari/proiecte", label: "Proiecte" },
  { href: "/setari/financiar", label: "Financiar" },
  { href: "/setari/notificari", label: "Notificări" },
  { href: "/setari/utilizatori", label: "Utilizatori" },
  { href: "/setari/date-test", label: "Date de test" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-3 mb-6 flex gap-1 overflow-x-auto border-b px-3 sm:mx-0 sm:px-0">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
              active && "border-brand text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
