"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EllipsisIcon, LogOutIcon, PlusIcon, SearchIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ROLE_LABELS } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOpenCommandMenu } from "./command-menu";
import { Logo } from "./logo";
import { initials, isActive, navForRole } from "./nav";
import { quickActionsFor } from "./quick-actions";
import { ThemeToggle } from "./theme-toggle";

/** Antetul de sus pe telefon: logo, căutare, adăugare rapidă. */
export function MobileTopBar({ profile }: { profile: Profile }) {
  const openSearch = useOpenCommandMenu();
  const actions = quickActionsFor(profile.role);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-background/85 px-3 backdrop-blur-md lg:hidden">
      <Link href="/" className="mr-auto" aria-label="Acasă">
        <Logo className="h-[17px]" />
      </Link>
      <button type="button" onClick={openSearch} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Caută">
        <SearchIcon className="size-[18px]" />
      </button>
      {actions.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm outline-none" aria-label="Adaugă rapid">
            <PlusIcon className="size-[18px]" strokeWidth={2.5} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Adaugă rapid</DropdownMenuLabel>
            {actions.map((a) => (
              <DropdownMenuItem key={a.href} asChild>
                <Link href={a.href}>
                  <a.icon /> {a.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </header>
  );
}

/** Bara de navigare de jos pe telefon (ca într-o aplicație nativă). */
export function MobileTabBar({ profile, badges }: { profile: Profile; badges: Record<string, number> }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = navForRole(profile.role);
  const primary = items.slice(0, 4);
  const rest = items.slice(4);
  const moreActive = rest.some((i) => isActive(pathname, i.href));

  const tab = (href: string, label: string, Icon: React.ComponentType<{ className?: string }>, active: boolean, badge?: number, onClick?: () => void) => {
    const inner = (
      <>
        <span className="relative">
          <Icon className={cn("size-[22px]", active ? "text-foreground" : "text-muted-foreground")} />
          {badge ? (
            <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 font-semibold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </span>
        <span className={cn("text-[10.5px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
        {active ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" /> : null}
      </>
    );
    const cls = "relative flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1";
    return onClick ? (
      <button key={href} type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    ) : (
      <Link key={href} href={href} className={cls}>
        {inner}
      </Link>
    );
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        {primary.map((i) => tab(i.href, i.short ?? i.label, i.icon, isActive(pathname, i.href), badges[i.href]))}
        {tab("#mai-mult", "Mai mult", EllipsisIcon, moreActive || moreOpen, undefined, () => setMoreOpen(true))}
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetTitle className="sr-only">Mai mult</SheetTitle>
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border-strong" />
          <div className="flex items-center gap-3 px-2 py-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
              {initials(profile.full_name || profile.email)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">{profile.full_name || profile.email}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LABELS[profile.role]}</div>
            </div>
          </div>
          <div className="grid gap-1">
            {rest.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setMoreOpen(false)}
                className={cn("flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium hover:bg-muted", isActive(pathname, i.href) && "bg-muted")}
              >
                <i.icon className="size-5 text-muted-foreground" /> {i.label}
              </Link>
            ))}
            <ThemeToggle savedTheme={profile.theme} withLabel className="h-12 rounded-xl px-3 text-[15px] font-medium hover:bg-muted [&_svg]:size-5 [&_svg]:text-muted-foreground" />
            <form action="/auth/signout" method="post">
              <button type="submit" className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-destructive hover:bg-muted">
                <LogOutIcon className="size-5" /> Deconectare
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
