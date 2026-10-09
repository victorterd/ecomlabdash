"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { UserRole } from "@/lib/types";
import { Logo } from "./logo";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav({ role, badges }: { role: UserRole; badges?: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Meniu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar p-3">
        <SheetTitle className="px-3 pt-2 pb-4">
          <Logo className="h-5" />
        </SheetTitle>
        <SidebarNav role={role} badges={badges} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
