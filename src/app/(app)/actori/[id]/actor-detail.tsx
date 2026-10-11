"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, AtSignIcon, MailIcon, PencilIcon, PhoneIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ActorDialog, RatingStars } from "@/components/actor-dialog";
import { ColorBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatRON, formatTime } from "@/lib/format";
import { formatPhone } from "@/lib/leads/normalize";
import { RATE_UNIT_LABEL, type Actor, type Shoot } from "@/lib/projects/types";
import type { ProjectStage } from "@/lib/types";
import { deleteActor } from "../actions";

export type ActorProject = {
  id: string;
  role_notes: string | null;
  agreed_fee: string | null;
  project: {
    id: string;
    client_name: string;
    description: string | null;
    start_date: string | null;
    deadline: string | null;
    current_stage_id: string | null;
    archived: boolean;
  };
};

export function ActorDetail({
  actor,
  projects,
  shoots,
  stages,
  today,
}: {
  actor: Actor;
  projects: ActorProject[];
  shoots: Shoot[];
  stages: ProjectStage[];
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const projectName = new Map(projects.map((p) => [p.project.id, p.project.client_name]));
  const upcoming = shoots.filter((s) => s.shoot_date >= today);
  const past = shoots.filter((s) => s.shoot_date < today).reverse();

  return (
    <div className="grid gap-6">
      <Link href="/actori" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Actori
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold">
            {actor.name}
            {!actor.active ? <span className="ml-2 text-sm font-normal text-muted-foreground">inactiv</span> : null}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <RatingStars value={actor.rating} />
            {actor.rate ? (
              <span className="font-medium text-foreground">
                {formatRON(actor.rate)} {RATE_UNIT_LABEL[actor.rate_unit]}
              </span>
            ) : null}
            {actor.phone ? (
              <a href={`tel:${actor.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <PhoneIcon className="size-3.5" /> {formatPhone(actor.phone)}
              </a>
            ) : null}
            {actor.email ? (
              <a href={`mailto:${actor.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <MailIcon className="size-3.5" /> {actor.email}
              </a>
            ) : null}
            {actor.instagram ? (
              <a
                href={`https://instagram.com/${actor.instagram.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <AtSignIcon className="size-3.5" /> {actor.instagram.replace(/^@/, "")}
              </a>
            ) : null}
          </div>
          {actor.notes ? <p className="max-w-2xl text-sm whitespace-pre-line">{actor.notes}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <PencilIcon /> Editează
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            disabled={pending}
            onClick={() =>
              confirm(`Ștergi actorul ${actor.name}?`) &&
              startTransition(async () => {
                const result = await deleteActor(actor.id);
                if (result.ok) {
                  toast.success("Actor șters");
                  router.push("/actori");
                } else toast.error(result.error);
              })
            }
          >
            <Trash2Icon /> Șterge
          </Button>
        </div>
      </div>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold">Proiecte ({projects.length})</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Încă nu a jucat în niciun proiect.</p>
        ) : (
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr className="[&>th]:h-9 [&>th]:px-3 [&>th]:text-left [&>th]:font-medium">
                    <th>Proiect</th>
                    <th>Rol</th>
                    <th>Stadiu</th>
                    <th>Perioadă</th>
                    <th className="text-right!">Onorariu</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const stage = p.project.current_stage_id ? stageById.get(p.project.current_stage_id) : undefined;
                    return (
                      <tr key={p.id} className="border-t [&>td]:px-3 [&>td]:py-2">
                        <td>
                          <Link href={`/proiecte/${p.project.id}?tab=actori`} className="font-medium hover:underline">
                            {p.project.client_name}
                          </Link>
                          {p.project.description ? <div className="text-xs text-muted-foreground">{p.project.description}</div> : null}
                        </td>
                        <td className="text-muted-foreground">{p.role_notes}</td>
                        <td>{stage ? <ColorBadge color={stage.color}>{stage.name}</ColorBadge> : null}</td>
                        <td className="whitespace-nowrap text-muted-foreground tabular-nums">
                          {formatDate(p.project.start_date)}
                          {p.project.deadline ? ` – ${formatDate(p.project.deadline)}` : ""}
                        </td>
                        <td className="text-right whitespace-nowrap tabular-nums">{p.agreed_fee ? formatRON(p.agreed_fee) : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold">Filmări</h2>
        {shoots.length === 0 ? <p className="text-sm text-muted-foreground">Nicio zi de filmare.</p> : null}
        {[...upcoming, ...past].map((s) => (
          <div key={s.id} className={`flex flex-wrap gap-x-3 text-sm ${s.shoot_date < today ? "text-muted-foreground" : ""}`}>
            <span className="w-24 font-medium tabular-nums">{formatDate(s.shoot_date)}</span>
            {s.start_time ? <span className="tabular-nums">{formatTime(s.start_time)}</span> : null}
            <span>{s.project_id ? (projectName.get(s.project_id) ?? "") : "fără proiect"}</span>
            {s.location ? <span className="text-muted-foreground">· {s.location}</span> : null}
          </div>
        ))}
      </section>

      <ActorDialog open={open} onOpenChange={setOpen} actor={actor} onSaved={() => router.refresh()} />
    </div>
  );
}
