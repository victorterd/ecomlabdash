"use client";

import { useEffect, useRef, useTransition } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { saveTheme } from "@/app/(app)/actions";
import type { Theme } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Tema light/dark, salvată pe profil (aceeași pe orice dispozitiv).
 * La prima încărcare aplică tema salvată.
 */
export function useThemeToggle(savedTheme: Theme) {
  const { resolvedTheme, setTheme } = useTheme();
  const [, startTransition] = useTransition();
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    setTheme(savedTheme === "dark" ? "dark" : "light");
  }, [savedTheme, setTheme]);

  return () => {
    const next: Theme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    startTransition(() => saveTheme(next));
  };
}

export function ThemeToggle({ savedTheme, className, withLabel }: { savedTheme: Theme; className?: string; withLabel?: boolean }) {
  const toggle = useThemeToggle(savedTheme);
  return (
    <button type="button" onClick={toggle} aria-label="Schimbă tema" className={cn("inline-flex items-center gap-3", className)}>
      <SunIcon className="hidden size-4 dark:block" />
      <MoonIcon className="size-4 dark:hidden" />
      {withLabel ? (
        <>
          <span className="dark:hidden">Mod întunecat</span>
          <span className="hidden dark:inline">Mod luminos</span>
        </>
      ) : null}
    </button>
  );
}
