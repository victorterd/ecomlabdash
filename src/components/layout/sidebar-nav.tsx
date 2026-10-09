"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isActive, navForRole } from "./nav";

export function SidebarNav({
  role,
  badges = {},
  onNavigate,
}: {
  role: UserRole;
  badges?: Record<string, number>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {navForRole(role).map((item) => {
        const active = isActive(pathname, item.href);
        const badge = badges[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              active && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent",
            )}
          >
            <item.icon className={cn("size-4 shrink-0", active ? "text-brand-strong" : "text-muted-foreground")} />
            <span className="flex-1 truncate">{item.label}</span>
            {badge ? (
              <span className="min-w-5 rounded-full bg-destructive px-1.5 text-center text-[11px] leading-5 font-semibold text-destructive-foreground">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
