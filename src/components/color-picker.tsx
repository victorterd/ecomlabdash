"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const PALETTE = [
  "#64748b",
  "#1cdb10",
  "#16a34a",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#f59e0b",
];

export function ColorPicker({ value, onChange, label = "Culoare" }: { value: string; onChange: (color: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(value);

  function pick(color: string) {
    setOpen(false);
    if (color.toLowerCase() !== value.toLowerCase()) onChange(color.toLowerCase());
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setCustom(value);
      }}
    >
      <PopoverTrigger
        className="inline-flex size-8 items-center justify-center rounded-md border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label={label}
      >
        <span className="size-5 rounded" style={{ backgroundColor: value }} />
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="grid grid-cols-6 gap-1.5">
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className="flex size-7 items-center justify-center rounded-md"
              style={{ backgroundColor: color }}
              onClick={() => pick(color)}
              aria-label={color}
            >
              {color === value.toLowerCase() ? <CheckIcon className="size-4 text-white" /> : null}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^#[0-9a-fA-F]{6}$/.test(custom)) pick(custom);
          }}
        >
          <span
            className="size-7 shrink-0 rounded-md border"
            style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(custom) ? custom : "transparent" }}
          />
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className={cn("h-8 font-mono text-xs")}
            maxLength={7}
            aria-label="Cod hex"
          />
        </form>
      </PopoverContent>
    </Popover>
  );
}
