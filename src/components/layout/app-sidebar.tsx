"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeftIcon, ChevronsRightIcon, LogOutIcon, PlusIcon, SearchIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROLE_LABELS } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOpenCommandMenu } from "./command-menu";
import { Logo, LogoMark } from "./logo";
import { groupsForRole, initials, isActive, SETTINGS_ITEM, SIDEBAR_COOKIE, type NavItem } from "./nav";
import { quickActionsFor } from "./quick-actions";
import { ThemeToggle } from "./theme-toggle";


export function AppSidebar({ profile, badges, defaultCollapsed }: { profile: Profile; badges: Record<string, number>; defaultCollapsed: boolean }) {
  const pathname = usePathname();
  const openSearch = useOpenCommandMenu();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const groups = groupsForRole(profile.role);
  const actions = quickActionsFor(profile.role);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  const link = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    const badge = badges[item.href];
    const content = (
      <Link
        href={item.href}
        className={cn(
          "group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active && "bg-sidebar-accent text-sidebar-accent-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        {active ? <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-brand" /> : null}
        <item.icon className={cn("size-[18px] shrink-0", active ? "text-brand" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
        {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
        {badge ? (
          <span
            className={cn(
              "rounded-full bg-destructive text-center text-[10.5px] leading-[18px] font-semibold text-white tabular-nums",
              collapsed ? "absolute -top-0.5 right-1 min-w-4 px-1" : "min-w-5 px-1.5",
            )}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </Link>
    );
    return collapsed ? (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    ) : (
      <div key={item.href}>{content}</div>
    );
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
    >
      <div className={cn("flex h-16 items-center gap-2", collapsed ? "justify-center px-2" : "justify-between pr-2 pl-5")}>
        <Link href="/" aria-label="Acasă">
          {collapsed ? <LogoMark className="h-4" /> : <Logo onDark className="h-[19px]" />}
        </Link>
        {!collapsed ? (
          <button type="button" onClick={toggle} className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Restrânge meniul">
            <ChevronsLeftIcon className="size-4" />
          </button>
        ) : null}
      </div>

      <div className={cn("flex gap-2 pb-3", collapsed ? "flex-col items-center px-2" : "px-3")}>
        <button
          type="button"
          onClick={openSearch}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/60 text-[13px] text-sidebar-muted transition-colors hover:text-sidebar-foreground",
            collapsed ? "w-9 justify-center" : "flex-1 px-2.5",
          )}
          aria-label="Caută (⌘K)"
        >
          <SearchIcon className="size-4 shrink-0" />
          {!collapsed ? (
            <>
              <span className="flex-1 text-left">Caută…</span>
              <kbd className="rounded border border-sidebar-border px-1 text-[10px]">⌘K</kbd>
            </>
          ) : null}
        </button>
        {actions.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm transition-[filter] outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-brand/50"
              aria-label="Adaugă rapid"
            >
              <PlusIcon className="size-4" strokeWidth={2.5} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align={collapsed ? "start" : "end"} side={collapsed ? "right" : "bottom"} className="w-52">
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
      </div>

      <nav className={cn("flex-1 overflow-y-auto pb-4", collapsed ? "px-2" : "px-3")}>
        {groups.map((group, i) => (
          <div key={group.label ?? i} className="mt-3 first:mt-0">
            {group.label && !collapsed ? (
              <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-sidebar-muted uppercase">{group.label}</div>
            ) : group.label ? (
              <div className="mx-auto my-2 h-px w-6 bg-sidebar-border" />
            ) : null}
            <div className="grid gap-0.5">{group.items.map(link)}</div>
          </div>
        ))}
      </nav>

      <div className={cn("grid gap-0.5 border-t border-sidebar-border py-3", collapsed ? "px-2" : "px-3")}>
        {profile.role === "admin" ? link(SETTINGS_ITEM) : null}
        <ThemeToggle
          savedTheme={profile.theme}
          withLabel={!collapsed}
          className={cn(
            "h-9 rounded-lg px-2.5 text-[13.5px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:text-sidebar-muted",
            collapsed && "justify-center px-0",
          )}
        />
        {collapsed ? (
          <button type="button" onClick={toggle} className="flex h-9 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Extinde meniul">
            <ChevronsRightIcon className="size-4" />
          </button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Cont"
            className={cn(
              "mt-1 flex items-center gap-2.5 rounded-lg p-1.5 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-brand/40",
              collapsed && "justify-center",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">
              {initials(profile.full_name || profile.email)}
            </span>
            {!collapsed ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-sidebar-accent-foreground">{profile.full_name || profile.email}</span>
                <span className="block truncate text-[11px] text-sidebar-muted">{ROLE_LABELS[profile.role]}</span>
              </span>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate">{profile.full_name || profile.email}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{profile.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <form action="/auth/signout" method="post">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOutIcon /> Deconectare
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
