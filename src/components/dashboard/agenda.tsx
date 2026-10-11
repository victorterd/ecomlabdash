"use client";

import { useState } from "react";
import { CalendarCheck2Icon } from "lucide-react";
import type { Reminder } from "@/lib/reminders/collect";
import { cn } from "@/lib/utils";

type TabKey = "today" | "overdue" | "upcoming";

/** Agenda de pe Dashboard: Azi / Restante / Următoarele zile, într-un singur card. */
export function Agenda({
  today,
  overdue,
  upcoming,
  render,
}: {
  today: Reminder[];
  overdue: Reminder[];
  upcoming: Reminder[];
  render: Record<TabKey, React.ReactNode>;
}) {
  const [tab, setTab] = useState<TabKey>(today.length || !overdue.length ? "today" : "overdue");
  const tabs: { key: TabKey; label: string; count: number; tone?: "bad" }[] = [
    { key: "today", label: "Azi", count: today.length },
    { key: "overdue", label: "Restante", count: overdue.length, tone: "bad" },
    { key: "upcoming", label: "Următoarele 3 zile", count: upcoming.length },
  ];
  const empty = { today: "Nimic programat pentru azi.", overdue: "Nicio restanță. Bravo!", upcoming: "Nimic în următoarele 3 zile." }[tab];
  const count = { today: today.length, overdue: overdue.length, upcoming: upcoming.length }[tab];

  return (
    <section className="surface flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="text-[15px] font-semibold">Agenda</h2>
        <div className="flex gap-1 rounded-xl border bg-muted/60 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                tab === t.key && "bg-card text-foreground shadow-sm",
              )}
            >
              {t.label}
              {t.count ? (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-[11px] leading-[18px] tabular-nums",
                    t.tone === "bad" ? "bg-destructive text-white" : "bg-muted-foreground/15 text-foreground",
                  )}
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 px-3 py-2">
        {count ? (
          render[tab]
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
              <CalendarCheck2Icon className="size-5" />
            </span>
            <p className="text-sm text-muted-foreground">{empty}</p>
          </div>
        )}
      </div>
    </section>
  );
}
