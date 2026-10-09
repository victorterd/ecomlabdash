"use client";

import { useEffect, useRef, useTransition } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveTheme } from "@/app/(app)/actions";
import type { Theme } from "@/lib/types";

/**
 * Comută light/dark și salvează alegerea pe profilul utilizatorului,
 * ca să fie aceeași pe orice dispozitiv.
 */
export function ThemeToggle({ savedTheme }: { savedTheme: Theme }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [, startTransition] = useTransition();
  const synced = useRef(false);

  // La prima încărcare aplicăm tema salvată pe profil.
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    setTheme(savedTheme === "dark" ? "dark" : "light");
  }, [savedTheme, setTheme]);

  function toggle() {
    const next: Theme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    startTransition(() => saveTheme(next));
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Schimbă tema">
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  );
}
