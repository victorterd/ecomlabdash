"use client";

import { useRef, useState } from "react";
import { CalendarIcon, XIcon } from "lucide-react";
import { formatDate, parseDateRO } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Câmp de dată afișat mereu ca zz.ll.aaaa (indiferent de limba browserului).
 * Se poate scrie de mână sau alege din calendarul nativ (iconița).
 * `value` / `onChange` folosesc formatul ISO „aaaa-ll-zz”.
 */
export function DateField({
  value,
  onChange,
  className,
  placeholder = "zz.ll.aaaa",
  clearable = true,
  autoFocus,
  id,
  "aria-label": ariaLabel,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  placeholder?: string;
  clearable?: boolean;
  autoFocus?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(formatDate(value));
  const [lastValue, setLastValue] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Sincronizare când valoarea se schimbă din exterior.
  if (value !== lastValue) {
    setLastValue(value);
    setText(formatDate(value));
    setInvalid(false);
  }

  function commit(raw: string) {
    if (!raw.trim()) {
      setInvalid(false);
      if (value !== null) onChange(null);
      return;
    }
    const iso = parseDateRO(raw);
    if (!iso) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(formatDate(iso));
    if (iso !== value) onChange(iso);
  }

  return (
    <div
      className={cn(
        "relative flex h-9 items-center rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40",
        invalid && "border-destructive",
        className,
      )}
    >
      <input
        id={id}
        aria-label={ariaLabel}
        value={text}
        placeholder={placeholder}
        inputMode="numeric"
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(e.currentTarget.value);
          }
        }}
        className="h-full w-full min-w-0 bg-transparent pl-3 text-sm tabular-nums outline-none placeholder:text-muted-foreground"
      />
      {clearable && value ? (
        <button
          type="button"
          className="px-1 text-muted-foreground hover:text-foreground"
          onClick={() => commit("")}
          aria-label="Șterge data"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        className="relative flex h-full items-center px-2 text-muted-foreground hover:text-foreground"
        onClick={() => {
          const picker = pickerRef.current;
          if (!picker) return;
          picker.value = value ?? "";
          try {
            picker.showPicker();
          } catch {
            picker.focus();
          }
        }}
        aria-label="Alege din calendar"
      >
        <CalendarIcon className="size-4" />
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0"
          onChange={(e) => e.target.value && commit(formatDate(e.target.value))}
        />
      </button>
    </div>
  );
}
