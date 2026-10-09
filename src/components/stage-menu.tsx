"use client";

import { CheckIcon } from "lucide-react";
import { ColorBadge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ProjectStage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StageMenu({
  stages,
  value,
  onChange,
  className,
}: {
  stages: ProjectStage[];
  value: string | null;
  onChange: (stageId: string) => void;
  className?: string;
}) {
  const current = stages.find((s) => s.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50", className)}
        aria-label="Schimbă stadiul"
      >
        {current ? (
          <ColorBadge color={current.color}>{current.name}</ColorBadge>
        ) : (
          <span className="text-sm text-muted-foreground">Fără stadiu</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {stages.map((s, i) => (
          <DropdownMenuItem key={s.id} onSelect={() => s.id !== value && onChange(s.id)}>
            <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="flex-1">{s.name}</span>
            {s.id === value ? <CheckIcon /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
