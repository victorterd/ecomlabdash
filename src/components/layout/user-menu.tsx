"use client";

import Link from "next/link";
import { LogOutIcon, SettingsIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/labels";
import type { Profile } from "@/lib/types";

export function UserMenu({ profile }: { profile: Profile }) {
  const initials = (profile.full_name || profile.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label="Cont"
      >
        {initials || "?"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{profile.full_name || profile.email}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {profile.email} · {ROLE_LABELS[profile.role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profile.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/setari">
              <SettingsIcon /> Setări
            </Link>
          </DropdownMenuItem>
        )}
        <form action="/auth/signout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOutIcon /> Deconectare
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
