"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { CalendarPlusIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { ShootDialog, type ProjectOption } from "@/components/shoot-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatTime } from "@/lib/format";
import type { Actor, Shoot } from "@/lib/projects/types";
import { dropSearchParam } from "@/lib/url";
import { cn } from "@/lib/utils";

export type CalendarEvent = {
  id: string;
  kind: "shoot" | "deadline" | "stage" | "followup";
  date: string;
  time?: string | null;
  title: string;
  detail?: string;
  color?: string;
  href?: string;
  shoot?: Shoot;
};

type Kind = CalendarEvent["kind"];

const KIND_LABEL: Record<Kind, string> = { shoot: "Filmări", deadline: "Deadline-uri", stage: "Pași proiect", followup: "Follow-up-uri" };
const KIND_STYLE: Record<Kind, string> = {
  shoot: "bg-brand/15 text-foreground border-l-brand",
  deadline: "bg-danger-soft text-destructive border-l-destructive",
  stage: "bg-warning-soft text-foreground border-l-warning",
  followup: "bg-blue-500/10 text-foreground border-l-blue-500",
};
const DOT: Record<Kind, string> = { shoot: "bg-brand", deadline: "bg-destructive", stage: "bg-warning", followup: "bg-blue-500" };
const WEEKDAYS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];
const STORAGE_KEY = "calendar-filters";

export function CalendarView({
  view,
  anchor,
  from,
  to,
  prev,
  next,
  today,
  events,
  showFollowUps,
  projects,
  actors,
  projectActorIds,
}: {
  view: "luna" | "saptamana";
  anchor: string;
  from: string;
  to: string;
  prev: string;
  next: string;
  today: string;
  events: CalendarEvent[];
  showFollowUps: boolean;
  projects: ProjectOption[];
  actors: Actor[];
  projectActorIds: Record<string, string[]>;
}) {
  const router = useRouter();
  const kinds: Kind[] = showFollowUps ? ["shoot", "deadline", "stage", "followup"] : ["shoot", "deadline", "stage"];
  const [enabled, setEnabled] = useState<Record<Kind, boolean>>({ shoot: true, deadline: true, stage: true, followup: true });
  const searchParams = useSearchParams();
  // ?nou=1 (din butonul „+” / ⌘K) deschide direct formularul de filmare.
  const [dialog, setDialog] = useState<{ open: boolean; shoot: Shoot | null; date: string | null }>(() => ({
    open: searchParams.get("nou") === "1",
    shoot: null,
    date: today,
  }));

  // Filtrele se păstrează în browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- citire unică din localStorage după montare
      if (saved) setEnabled((e) => ({ ...e, ...JSON.parse(saved) }));
    } catch {}
  }, []);
  function toggle(kind: Kind, value: boolean) {
    const nextState = { ...enabled, [kind]: value };
    setEnabled(nextState);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {}
  }

  const days = useMemo(() => {
    const list: string[] = [];
    for (let d = parseISO(from); format(d, "yyyy-MM-dd") <= to; d = addDays(d, 1)) list.push(format(d, "yyyy-MM-dd"));
    return list;
  }, [from, to]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!enabled[e.kind]) continue;
      map.set(e.date, [...(map.get(e.date) ?? []), e]);
    }
    const order: Record<Kind, number> = { deadline: 0, shoot: 1, stage: 2, followup: 3 };
    for (const list of map.values()) list.sort((a, b) => order[a.kind] - order[b.kind] || (a.time ?? "").localeCompare(b.time ?? ""));
    return map;
  }, [events, enabled]);

  const month = anchor.slice(0, 7);
  const title =
    view === "luna"
      ? format(parseISO(anchor), "LLLL yyyy", { locale: ro })
      : `${format(parseISO(from), "d MMM", { locale: ro })} – ${format(parseISO(to), "d MMM yyyy", { locale: ro })}`;
  const href = (d: string, v = view) => `/calendar?v=${v}&d=${d}`;

  function openEvent(e: CalendarEvent) {
    if (e.shoot) setDialog({ open: true, shoot: e.shoot, date: null });
    else if (e.href) router.push(e.href);
  }

  const eventChip = (e: CalendarEvent, compact: boolean) => (
    <button
      key={e.id}
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        openEvent(e);
      }}
      className={cn("w-full truncate rounded border-l-2 px-1.5 py-0.5 text-left text-xs hover:brightness-95", KIND_STYLE[e.kind])}
      title={[e.time ? formatTime(e.time) : null, e.title, e.detail].filter(Boolean).join(" · ")}
    >
      {e.time ? <span className="mr-1 tabular-nums opacity-70">{formatTime(e.time)}</span> : null}
      <span className="font-medium">{e.title}</span>
      {!compact && e.detail ? <span className="block truncate opacity-70">{e.detail}</span> : null}
      {compact && e.kind === "stage" && e.detail ? <span className="opacity-70"> · {e.detail}</span> : null}
    </button>
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" asChild>
            <Link href={href(prev)} aria-label="Înapoi">
              <ChevronLeftIcon />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={href(today)}>Azi</Link>
          </Button>
          <Button variant="outline" size="icon-sm" asChild>
            <Link href={href(next)} aria-label="Înainte">
              <ChevronRightIcon />
            </Link>
          </Button>
        </div>
        <h2 className="min-w-44 text-lg font-semibold capitalize">{title}</h2>
        <div className="inline-flex rounded-lg bg-muted p-1">
          {(["luna", "saptamana"] as const).map((v) => (
            <Link
              key={v}
              href={href(anchor, v)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground",
                view === v && "bg-card text-foreground shadow-sm",
              )}
            >
              {v === "luna" ? "Lună" : "Săptămână"}
            </Link>
          ))}
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setDialog({ open: true, shoot: null, date: today >= from && today <= to ? today : from })}>
          <CalendarPlusIcon /> Filmare nouă
        </Button>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {kinds.map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <Checkbox checked={enabled[k]} onCheckedChange={(v) => toggle(k, v === true)} />
            <span className={cn("size-2 rounded-full", DOT[k])} />
            {KIND_LABEL[k]}
          </label>
        ))}
      </div>

      {/* Grilă (tabletă / desktop) */}
      <div className="surface hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const list = byDay.get(day) ?? [];
            const outside = view === "luna" && !day.startsWith(month);
            const limit = view === "luna" ? 4 : 50;
            return (
              <div
                key={day}
                role="button"
                tabIndex={0}
                onClick={() => setDialog({ open: true, shoot: null, date: day })}
                onKeyDown={(e) => e.key === "Enter" && setDialog({ open: true, shoot: null, date: day })}
                className={cn(
                  "group flex cursor-pointer flex-col gap-1 border-b p-1.5 hover:bg-muted/40",
                  i % 7 !== 6 && "border-r",
                  view === "luna" ? "min-h-28" : "min-h-80",
                  outside && "bg-muted/30",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                      outside && "text-muted-foreground",
                      day === today && "bg-brand font-semibold text-brand-foreground",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <CalendarPlusIcon className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
                {list.slice(0, limit).map((e) => eventChip(e, view === "luna"))}
                {list.length > limit ? (
                  <Link
                    href={href(day, "saptamana")}
                    onClick={(e) => e.stopPropagation()}
                    className="px-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    +{list.length - limit} altele
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agendă (telefon) */}
      <div className="grid gap-3 md:hidden">
        {days
          .filter((d) => (view === "luna" ? d.startsWith(month) : true))
          .filter((d) => (byDay.get(d)?.length ?? 0) > 0 || d === today)
          .map((day) => (
            <div key={day} className="grid gap-1.5">
              <div className={cn("text-sm font-semibold capitalize", day === today && "text-brand-strong")}>
                {format(parseISO(day), "EEEE, d MMMM", { locale: ro })}
                {day === today ? " · azi" : ""}
              </div>
              {(byDay.get(day) ?? []).map((e) => eventChip(e, false))}
              {(byDay.get(day) ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Nimic programat.</p> : null}
            </div>
          ))}
      </div>

      <ShootDialog
        open={dialog.open}
        onOpenChange={(open) => {
          setDialog((d) => ({ ...d, open }));
          if (!open) dropSearchParam("nou");
        }}
        shoot={dialog.shoot}
        defaultDate={dialog.date}
        projects={projects}
        actors={actors}
        projectActorIds={projectActorIds}
        onSaved={() => router.refresh()}
        onDeleted={() => router.refresh()}
      />
    </div>
  );
}
