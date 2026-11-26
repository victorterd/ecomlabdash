"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import type { Service } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

/** Alegerea serviciilor unui proiect (se pot bifa mai multe). */
export function ServicePicker({
  services,
  value,
  onToggle,
  disabled,
}: {
  services: Service[];
  value: string[];
  onToggle: (serviceId: string, selected: boolean) => void;
  disabled?: boolean;
}) {
  // Serviciile dezactivate apar doar dacă sunt deja pe proiect.
  const visible = services.filter((s) => s.active || value.includes(s.id));
  if (!visible.length) {
    return <p className="text-sm text-muted-foreground">Nu ai servicii definite. Le adaugi din Setări → Proiecte.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((s) => {
        const selected = value.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onToggle(s.id, !selected)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3.5 text-sm font-medium transition-colors hover:border-border-strong disabled:opacity-60",
              selected ? "text-foreground" : "text-muted-foreground",
            )}
            style={
              selected
                ? {
                    borderColor: s.color,
                    backgroundColor: `color-mix(in oklab, ${s.color} 12%, var(--card))`,
                  }
                : undefined
            }
          >
            {selected ? (
              <CheckIcon className="size-4" style={{ color: s.color }} />
            ) : (
              <PlusIcon className="size-4 opacity-60" />
            )}
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
