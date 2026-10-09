import Link from "next/link";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CalendarClockIcon,
  ClapperboardIcon,
  FlagIcon,
  PhoneCallIcon,
  PhoneIcon,
  type LucideIcon,
} from "lucide-react";
import { daysBetween } from "@/lib/projects/health";
import { formatDate, formatRON, formatTime } from "@/lib/format";
import { formatPhone } from "@/lib/leads/normalize";
import { KIND_LABEL, type Reminder, type ReminderKind } from "@/lib/reminders/collect";
import { cn } from "@/lib/utils";

const ICON: Record<ReminderKind, LucideIcon> = {
  followup: PhoneCallIcon,
  installment: ArrowDownLeftIcon,
  payment: ArrowUpRightIcon,
  shoot: ClapperboardIcon,
  stage: CalendarClockIcon,
  deadline: FlagIcon,
};

const ICON_TONE: Record<ReminderKind, string> = {
  followup: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  installment: "bg-success/10 text-success",
  payment: "bg-muted text-muted-foreground",
  shoot: "bg-brand/15 text-brand-strong",
  stage: "bg-warning-soft text-warning",
  deadline: "bg-danger-soft text-destructive",
};

export function whenLabel(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "azi";
  if (diff === 1) return "mâine";
  if (diff === -1) return "de ieri";
  if (diff < 0) return `de ${-diff} zile`;
  return `în ${diff} zile`;
}

export function ReminderList({
  items,
  today,
  empty,
  limit = 8,
  moreHref,
}: {
  items: Reminder[];
  today: string;
  empty: string;
  limit?: number;
  moreHref?: string;
}) {
  if (!items.length) return <p className="px-1 py-3 text-sm text-muted-foreground">{empty}</p>;
  const shown = items.slice(0, limit);
  return (
    <ul className="grid grid-cols-1 gap-0.5">
      {shown.map((item) => {
        const Icon = ICON[item.kind];
        const overdue = item.date < today;
        return (
          <li key={item.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-muted/50">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", ICON_TONE[item.kind])}>
              <Icon className="size-4" />
            </span>
            <Link href={item.href} className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{item.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {KIND_LABEL[item.kind]}
                {item.detail && item.detail !== KIND_LABEL[item.kind] ? ` · ${item.detail}` : ""}
              </div>
            </Link>
            <div className="shrink-0 text-right text-xs">
              {item.amount ? <div className="font-semibold text-foreground tabular-nums">{formatRON(item.amount)}</div> : null}
              <div
                className={cn("tabular-nums", overdue ? "font-medium text-destructive" : "text-muted-foreground")}
                title={formatDate(item.date)}
              >
                {item.time ? `${formatTime(item.time)} · ` : ""}
                {whenLabel(item.date, today)}
              </div>
            </div>
            {item.phone ? (
              <a
                href={`tel:${item.phone.split(",")[0]}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground"
                aria-label={`Sună ${formatPhone(item.phone)}`}
                title={formatPhone(item.phone)}
              >
                <PhoneIcon className="size-3.5" />
              </a>
            ) : null}
          </li>
        );
      })}
      {items.length > limit ? (
        <li className="px-1 pt-1 text-xs text-muted-foreground">
          {moreHref ? (
            <Link href={moreHref} className="hover:text-foreground">
              + încă {items.length - limit}
            </Link>
          ) : (
            `+ încă ${items.length - limit}`
          )}
        </li>
      ) : null}
    </ul>
  );
}
