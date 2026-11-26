"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteShoot, saveShoot } from "@/app/(app)/calendar/actions";
import { ActorPicker } from "@/components/actor-picker";
import { DateField } from "@/components/date-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, parseTimeInput } from "@/lib/format";
import type { Actor, Shoot } from "@/lib/projects/types";

const NO_PROJECT = "__none__";

export type ProjectOption = { id: string; client_name: string; archived: boolean };

export function ShootDialog({
  open,
  onOpenChange,
  shoot,
  defaultDate,
  defaultProjectId,
  projects,
  actors,
  projectActorIds = {},
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shoot: Shoot | null;
  defaultDate?: string | null;
  defaultProjectId?: string | null;
  projects: ProjectOption[];
  actors: Actor[];
  /** Actorii alocați fiecărui proiect, ca să apară primii. */
  projectActorIds?: Record<string, string[]>;
  onSaved?: (shoot: Shoot) => void;
  onDeleted?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{shoot ? "Editează filmarea" : "Filmare nouă"}</DialogTitle>
        </DialogHeader>
        {open ? (
          <ShootForm
            key={shoot?.id ?? "new"}
            shoot={shoot}
            defaultDate={defaultDate ?? null}
            defaultProjectId={defaultProjectId ?? null}
            projects={projects}
            actors={actors}
            projectActorIds={projectActorIds}
            onDone={(saved) => {
              onOpenChange(false);
              if (saved) onSaved?.(saved);
            }}
            onDeleted={(id) => {
              onOpenChange(false);
              onDeleted?.(id);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ShootForm({
  shoot,
  defaultDate,
  defaultProjectId,
  projects,
  actors,
  projectActorIds,
  onDone,
  onDeleted,
}: {
  shoot: Shoot | null;
  defaultDate: string | null;
  defaultProjectId: string | null;
  projects: ProjectOption[];
  actors: Actor[];
  projectActorIds: Record<string, string[]>;
  onDone: (saved: Shoot | null) => void;
  onDeleted: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(shoot?.project_id ?? defaultProjectId ?? NO_PROJECT);
  const [date, setDate] = useState<string | null>(shoot?.shoot_date ?? defaultDate);
  const [actorIds, setActorIds] = useState<string[]>(
    shoot?.actor_ids ?? (defaultProjectId ? (projectActorIds[defaultProjectId] ?? []) : []),
  );
  const [error, setError] = useState<string | null>(null);
  const visibleProjects = projects.filter((p) => !p.archived || p.id === projectId);
  const currentProject = projects.find((p) => p.id === projectId);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const start = parseTimeInput(String(data.get("start_time") ?? ""));
        const end = parseTimeInput(String(data.get("end_time") ?? ""));
        if (start === undefined || end === undefined) {
          setError("Ora trebuie să fie de forma 09:30");
          return;
        }
        const values = {
          project_id: projectId === NO_PROJECT ? null : projectId,
          shoot_date: date ?? "",
          start_time: start,
          end_time: end,
          location: String(data.get("location") ?? ""),
          notes: String(data.get("notes") ?? ""),
          actor_ids: actorIds,
        };
        setError(null);
        startTransition(async () => {
          const result = await saveShoot(shoot?.id ?? null, values);
          if (result.ok) {
            toast.success(shoot ? "Filmare actualizată" : "Filmare adăugată");
            onDone(result.data);
          } else setError(result.error);
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label>Proiect</Label>
        <Select
          value={projectId}
          onValueChange={(v) => {
            setProjectId(v);
            // Propunem actorii alocați proiectului, dacă încă n-a fost ales nimeni.
            if (!actorIds.length && projectActorIds[v]) setActorIds(projectActorIds[v]);
          }}
        >
          <SelectTrigger>
            <SelectValue>{currentProject?.client_name ?? "Fără proiect"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PROJECT}>Fără proiect</SelectItem>
            {visibleProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.client_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-2">
        <div className="grid gap-1.5">
          <Label>Data *</Label>
          <DateField value={date} onChange={setDate} clearable={false} aria-label="Data filmării" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="shoot-start">De la</Label>
          <Input id="shoot-start" name="start_time" defaultValue={formatTime(shoot?.start_time)} placeholder="09:00" inputMode="numeric" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="shoot-end">Până la</Label>
          <Input id="shoot-end" name="end_time" defaultValue={formatTime(shoot?.end_time)} placeholder="14:00" inputMode="numeric" />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="shoot-location">Locație</Label>
        <Input id="shoot-location" name="location" defaultValue={shoot?.location ?? ""} placeholder="ex. Studio, adresa clientului" />
      </div>
      <div className="grid gap-1.5">
        <Label>Actori</Label>
        <ActorPicker
          actors={actors}
          value={actorIds}
          onChange={setActorIds}
          highlight={projectId !== NO_PROJECT ? (projectActorIds[projectId] ?? []) : []}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="shoot-notes">Notițe</Label>
        <Textarea id="shoot-notes" name="notes" rows={3} defaultValue={shoot?.notes ?? ""} />
      </div>
      {error ? <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <DialogFooter className="sm:justify-between">
        {shoot ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            disabled={pending}
            onClick={() => {
              if (!confirm("Ștergi filmarea?")) return;
              startTransition(async () => {
                const result = await deleteShoot(shoot.id);
                if (result.ok) {
                  toast.success("Filmare ștearsă");
                  onDeleted(shoot.id);
                } else toast.error(result.error);
              });
            }}
          >
            <Trash2Icon /> Șterge
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Salvează
        </Button>
      </DialogFooter>
    </form>
  );
}
