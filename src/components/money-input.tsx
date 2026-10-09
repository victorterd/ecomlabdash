"use client";

import { useState } from "react";
import { formatNumber, parseMoneyInput } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Sumă în RON: se scrie „românește” (12.500,50), se salvează la ieșirea din câmp.
 * `value` / `onCommit` folosesc string zecimal („12500.50”) sau null.
 */
export function MoneyInput({
  value,
  onCommit,
  className,
  placeholder = "0,00",
  allowEmpty = false,
  autoFocus,
  id,
  "aria-label": ariaLabel,
}: {
  value: string | null;
  onCommit: (value: string | null) => void;
  className?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  autoFocus?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const display = (v: string | null) => (v === null || v === "" ? "" : formatNumber(v));
  const [text, setText] = useState(display(value));
  const [last, setLast] = useState(value);
  const [invalid, setInvalid] = useState(false);
  if (value !== last) {
    setLast(value);
    setText(display(value));
    setInvalid(false);
  }

  function commit() {
    if (!text.trim()) {
      if (allowEmpty) {
        setInvalid(false);
        if (value !== null) onCommit(null);
      } else setText(display(value));
      return;
    }
    const parsed = parseMoneyInput(text);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(display(parsed));
    if (value === null || Number(parsed) !== Number(value)) onCommit(parsed);
  }

  return (
    <div
      className={cn(
        "flex h-9 items-center rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40",
        invalid && "border-destructive",
        className,
      )}
    >
      <input
        id={id}
        aria-label={ariaLabel}
        value={text}
        placeholder={placeholder}
        inputMode="decimal"
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="h-full w-full min-w-0 bg-transparent pl-3 text-right text-sm tabular-nums outline-none placeholder:text-muted-foreground"
      />
      <span className="px-2 text-xs text-muted-foreground">RON</span>
    </div>
  );
}
