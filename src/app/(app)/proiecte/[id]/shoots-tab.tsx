"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlusIcon, ClockIcon, MapPinIcon, UsersRoundIcon } from "lucide-react";
import { ShootDialog, type ProjectOption } from "@/components/shoot-dialog";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/format";
import type { Actor, Shoot } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"];

export function ShootsTab({
  projectId,
  shoots,
  actors,
  projectActorIds,
  projectOptions,
  today,
  onShoots,
}: {
  projectId: string;
  shoots: Shoot[];
  actors: Actor[];
  projectActorIds: string[];
  projectOptions: ProjectOption[];
  today: string;
  onShoots: (shoots: Shoot[]) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shoot | null>(null);
  const actorById = new Map(actors.map((a) => [a.id, a]));
  const sorted = [...shoots].sort(
    (a, b) => a.shoot_date.localeCompare(b.shoot_date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""),
  );

  return (
    <div className="grid gap-4">
      <div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <CalendarPlusIcon /> Zi de filmare
        </Button>
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Nicio zi de filmare programată.
        </div>
      ) : (
        <div className="grid gap-2">
          {sorted.map((s) => {
            const past = s.shoot_date < today;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setEditing(s);
                  setOpen(true);
                }}
                className={cn(
                  "grid gap-1 rounded-lg border p-3 text-left text-sm hover:bg-muted/50",
                  past && "opacity-60",
                  s.shoot_date === today && "border-brand bg-accent/50",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">
                    {formatDate(s.shoot_date)}{" "}
                    <span className="font-normal text-muted-foreground">{WEEKDAYS[new Date(`${s.shoot_date}T12:00:00`).getDay()]}</span>
                  </span>
                  {s.start_time ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <ClockIcon className="size-3.5" /> {formatTime(s.start_time)}
                      {s.end_time ? `–${formatTime(s.end_time)}` : ""}
                    </span>
                  ) : null}
                  {s.location ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MapPinIcon className="size-3.5" /> {s.location}
                    </span>
                  ) : null}
                </div>
                {s.actor_ids.length ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <UsersRoundIcon className="size-3.5" /> {s.actor_ids.map((id) => actorById.get(id)?.name ?? "?").join(", ")}
                  </span>
                ) : null}
                {s.notes ? <span className="text-muted-foreground">{s.notes}</span> : null}
              </button>
            );
          })}
        </div>
      )}
      <ShootDialog
        open={open}
        onOpenChange={setOpen}
        shoot={editing}
        defaultDate={today}
        defaultProjectId={projectId}
        projects={projectOptions}
        actors={actors}
        projectActorIds={{ [projectId]: projectActorIds }}
        onSaved={(saved) => {
          onShoots(
            saved.project_id === projectId ? [...shoots.filter((s) => s.id !== saved.id), saved] : shoots.filter((s) => s.id !== saved.id),
          );
          router.refresh();
        }}
        onDeleted={(id) => onShoots(shoots.filter((s) => s.id !== id))}
      />
    </div>
  );
}
