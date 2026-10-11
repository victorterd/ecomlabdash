import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Card de indicator (Dashboard, Financiar): etichetă, valoare mare, iconiță, notă. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  href,
  accent,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "good" | "bad" | "warn";
  href?: string;
  accent?: boolean;
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        "surface group relative h-full overflow-hidden p-4 transition-shadow sm:p-5",
        href && "hover:shadow-md",
        accent && "border-transparent bg-primary text-primary-foreground",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-[13px] leading-snug font-medium", accent ? "text-primary-foreground/70" : "text-muted-foreground")}>{label}</span>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            accent
              ? "bg-brand text-brand-foreground"
              : tone === "bad"
                ? "bg-danger-soft text-destructive"
                : tone === "warn"
                  ? "bg-warning-soft text-warning"
                  : tone === "good"
                    ? "bg-brand-soft text-brand-strong"
                    : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className={cn("mt-3 truncate text-[17px] font-semibold tracking-tight tabular-nums sm:text-2xl", tone === "bad" && !accent && "text-destructive")}>{value}</div>
      {hint ? <div className={cn("mt-1 truncate text-xs", accent ? "text-primary-foreground/60" : tone === "warn" ? "text-warning" : "text-muted-foreground")}>{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
