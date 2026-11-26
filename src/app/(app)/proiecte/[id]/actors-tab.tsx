"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, PlusIcon, ReceiptIcon, UserPlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { ActorDialog, RatingStars } from "@/components/actor-dialog";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRON } from "@/lib/format";
import { RATE_UNIT_LABEL, type Actor, type ProjectActor, type Transaction } from "@/lib/projects/types";
import { addActorCost, addProjectActor, removeProjectActor, updateProjectActor } from "../actions";

export function ActorsTab({
  projectId,
  projectActors,
  actors,
  transactions,
  isAdmin,
  onTransactions,
}: {
  projectId: string;
  projectActors: ProjectActor[];
  actors: Actor[];
  transactions: Transaction[];
  isAdmin: boolean;
  onTransactions: (t: Transaction[]) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pick, setPick] = useState<string>("");
  const [newActorOpen, setNewActorOpen] = useState(false);
  const actorById = new Map(actors.map((a) => [a.id, a]));
  const allocated = new Set(projectActors.map((pa) => pa.actor_id));
  const available = actors.filter((a) => a.active && !allocated.has(a.id));
  const costByActor = new Map(transactions.filter((t) => t.actor_id && t.type === "expense").map((t) => [t.actor_id!, t]));

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={pick} onValueChange={setPick}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Alege un actor…">{pick ? actorById.get(pick)?.name : undefined}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {available.length === 0 ? (
              <div className="px-2 py-2 text-sm text-muted-foreground">Toți actorii activi sunt deja alocați.</div>
            ) : null}
            {available.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
                {a.rate ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatRON(a.rate)} {RATE_UNIT_LABEL[a.rate_unit]}
                  </span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          disabled={!pick}
          onClick={() => {
            const actor = actorById.get(pick);
            run(() => addProjectActor(projectId, pick, actor?.rate ?? null), `${actor?.name} alocat`);
            setPick("");
          }}
        >
          <PlusIcon /> Alocă
        </Button>
        <Button variant="ghost" onClick={() => setNewActorOpen(true)}>
          <UserPlusIcon /> Actor nou
        </Button>
      </div>

      {projectActors.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
          Niciun actor alocat.
        </div>
      ) : (
        <div className="surface divide-y">
          {projectActors.map((pa) => {
            const actor = actorById.get(pa.actor_id);
            const cost = costByActor.get(pa.actor_id);
            return (
              <div key={pa.id} className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/actori/${pa.actor_id}`} className="font-medium hover:underline">
                      {actor?.name ?? "Actor șters"}
                    </Link>
                    <RatingStars value={actor?.rating ?? null} />
                    {actor?.rate ? (
                      <span className="text-xs text-muted-foreground">
                        tarif {formatRON(actor.rate)} {RATE_UNIT_LABEL[actor.rate_unit]}
                      </span>
                    ) : null}
                  </div>
                  <Input
                    key={pa.role_notes ?? ""}
                    defaultValue={pa.role_notes ?? ""}
                    placeholder="Rol / ce filmează (ex. 5 clipuri hook-uri)"
                    className="h-8 max-w-md"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (pa.role_notes ?? null)) run(() => updateProjectActor(pa.id, { role_notes: v }), "Salvat");
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Onorariu</span>
                  <MoneyInput
                    value={pa.agreed_fee}
                    allowEmpty
                    onCommit={(v) => run(() => updateProjectActor(pa.id, { agreed_fee: v }), "Salvat")}
                    className="h-8 w-36"
                    aria-label="Onorariu convenit"
                  />
                  {isAdmin ? (
                    cost ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <CheckIcon className="size-3.5" /> cost {cost.status === "realized" ? "plătit" : "planificat"}
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          startTransition(async () => {
                            const result = await addActorCost(pa.id);
                            if (result.ok) {
                              onTransactions(result.data);
                              toast.success("Adăugat la costuri");
                            } else toast.error(result.error);
                          })
                        }
                      >
                        <ReceiptIcon /> Adaugă ca cost
                      </Button>
                    )
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Scoate de pe proiect"
                    onClick={() =>
                      confirm(`Scoți ${actor?.name} de pe proiect?`) && run(() => removeProjectActor(pa.id), "Actor scos de pe proiect")
                    }
                  >
                    <XIcon />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ActorDialog
        open={newActorOpen}
        onOpenChange={setNewActorOpen}
        actor={null}
        onSaved={(actor) => run(() => addProjectActor(projectId, actor.id, actor.rate), `${actor.name} adăugat și alocat`)}
      />
    </div>
  );
}
