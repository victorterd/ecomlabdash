"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, SearchIcon } from "lucide-react";
import { ActorDialog, RatingStars } from "@/components/actor-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatRON } from "@/lib/format";
import { fold, formatPhone } from "@/lib/leads/normalize";
import { RATE_UNIT_LABEL, type Actor } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

export function ActorsView({ actors, projectCounts }: { actors: Actor[]; projectCounts: Record<string, number> }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);

  const visible = actors.filter(
    (a) =>
      (showInactive || a.active) && fold([a.name, a.instagram, a.email, a.phone, a.notes].filter(Boolean).join(" ")).includes(fold(search)),
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută actor…" className="pl-8" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} /> Arată inactivi
        </label>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusIcon /> Actor nou
        </Button>
      </div>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr className="[&>th]:h-9 [&>th]:px-3 [&>th]:text-left [&>th]:font-medium [&>th]:whitespace-nowrap">
                <th>Nume</th>
                <th>Telefon</th>
                <th>Email / Instagram</th>
                <th className="text-right!">Tarif</th>
                <th>Rating</th>
                <th className="text-right!">Proiecte</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id} className={cn("border-t [&>td]:px-3 [&>td]:py-2", !a.active && "text-muted-foreground")}>
                  <td className="font-medium">
                    <Link href={`/actori/${a.id}`} className="hover:underline">
                      {a.name}
                    </Link>
                    {!a.active ? <span className="ml-2 text-xs font-normal">inactiv</span> : null}
                    {a.is_seed ? (
                      <span className="ml-2 rounded bg-muted px-1 text-[10px] font-normal text-muted-foreground">test</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    {a.phone ? (
                      <a href={`tel:${a.phone}`} className="hover:underline">
                        {formatPhone(a.phone)}
                      </a>
                    ) : null}
                  </td>
                  <td className="max-w-64 truncate text-muted-foreground">{[a.email, a.instagram].filter(Boolean).join(" · ")}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {a.rate ? (
                      <>
                        {formatRON(a.rate)} <span className="text-xs text-muted-foreground">{RATE_UNIT_LABEL[a.rate_unit]}</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <RatingStars value={a.rating} />
                  </td>
                  <td className="text-right tabular-nums">{projectCounts[a.id] ?? 0}</td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {actors.length ? "Niciun actor nu corespunde căutării." : "Nu ai încă actori. Adaugă primul actor UGC."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <ActorDialog open={open} onOpenChange={setOpen} actor={null} onSaved={(actor) => router.push(`/actori/${actor.id}`)} />
    </div>
  );
}
