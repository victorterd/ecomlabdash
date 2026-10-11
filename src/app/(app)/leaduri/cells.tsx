"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { DateField } from "@/components/date-field";
import { ColorBadge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import type { LeadSource, LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const cellButton =
  "block w-full min-w-0 truncate rounded px-1.5 py-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50";

/** Text afișat; la click devine input. Enter/blur salvează, Esc anulează. */
export function InlineText({
  value,
  onSave,
  display,
  placeholder = "—",
  className,
  inputClassName,
  label,
}: {
  value: string | null;
  onSave: (value: string | null) => void;
  display?: React.ReactNode;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  label: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        autoFocus
        aria-label={label}
        defaultValue={value ?? ""}
        className={cn(
          "h-7 w-full min-w-28 rounded border border-ring bg-card px-1.5 text-sm outline-none ring-[3px] ring-ring/30",
          inputClassName,
        )}
        onBlur={(e) => {
          setEditing(false);
          const next = e.target.value.trim() || null;
          if (next !== (value ?? null)) onSave(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = value ?? "";
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(cellButton, className)}
      onClick={() => setEditing(true)}
      title={value ?? undefined}
      aria-label={`Editează ${label}`}
    >
      {value ? (display ?? value) : <span className="text-muted-foreground/60">{placeholder}</span>}
    </button>
  );
}

export function StatusMenu({
  statuses,
  value,
  onChange,
  className,
}: {
  statuses: LeadStatus[];
  value: string;
  onChange: (statusId: string) => void;
  className?: string;
}) {
  const current = statuses.find((s) => s.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50", className)}
        aria-label="Schimbă statusul"
      >
        {current ? <ColorBadge color={current.color}>{current.name}</ColorBadge> : <span className="text-muted-foreground">—</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {statuses.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => s.id !== value && onChange(s.id)}>
            <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="flex-1">{s.name}</span>
            {s.id === value ? <CheckIcon /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SourceMenu({
  sources,
  value,
  onChange,
  className,
}: {
  sources: LeadSource[];
  value: string | null;
  onChange: (sourceId: string | null) => void;
  className?: string;
}) {
  const current = sources.find((s) => s.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(cellButton, "w-auto", className)} aria-label="Schimbă sursa">
        {current ? current.name : <span className="text-muted-foreground/60">—</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {sources
          .filter((s) => s.active || s.id === value)
          .map((s) => (
            <DropdownMenuItem key={s.id} onSelect={() => s.id !== value && onChange(s.id)}>
              <span className="flex-1">{s.name}</span>
              {s.id === value ? <CheckIcon /> : null}
            </DropdownMenuItem>
          ))}
        {value ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(null)}>Fără sursă</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type FollowUpState = "overdue" | "today" | "upcoming" | null;

export function followUpState(date: string | null, closed: boolean, today: string): FollowUpState {
  if (!date || closed) return null;
  if (date < today) return "overdue";
  if (date === today) return "today";
  return "upcoming";
}

export function FollowUpCell({
  value,
  state,
  onSave,
}: {
  value: string | null;
  state: FollowUpState;
  onSave: (value: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEditing(false);
        }}
      >
        <DateField
          value={value}
          autoFocus
          className="h-7 w-36"
          aria-label="Dată follow-up"
          onChange={(next) => {
            onSave(next);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        cellButton,
        "tabular-nums",
        state === "overdue" && "font-semibold text-destructive",
        state === "today" && "font-semibold text-warning",
      )}
      onClick={() => setEditing(true)}
      aria-label="Editează data de follow-up"
    >
      {value ? formatDate(value) : <span className="font-normal text-muted-foreground/60">—</span>}
      {state === "overdue" ? <span className="ml-1 text-[11px] font-medium">restant</span> : null}
      {state === "today" ? <span className="ml-1 text-[11px] font-medium">azi</span> : null}
    </button>
  );
}
