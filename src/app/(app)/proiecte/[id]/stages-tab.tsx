"use client";

import { useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/date-field";
import { Button } from "@/components/ui/button";
import { daysBetween } from "@/lib/projects/health";
import type { StageDeadline } from "@/lib/projects/types";
import type { ProjectStage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { updateStageDeadline } from "../actions";

export function StagesTab({
  projectId,
  stages,
  currentStageId,
  deadlines,
  today,
  onChange,
}: {
  projectId: string;
  stages: ProjectStage[];
  currentStageId: string | null;
  deadlines: StageDeadline[];
  today: string;
  onChange: (deadline: StageDeadline) => void;
}) {
  const [, startTransition] = useTransition();
  const byStage = new Map(deadlines.map((d) => [d.stage_id, d]));

  function save(stageId: string, patch: { planned_date?: string | null; completed_date?: string | null }) {
    startTransition(async () => {
      const result = await updateStageDeadline(projectId, stageId, patch);
      if (result.ok) onChange(result.data);
      else toast.error(result.error);
    });
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Termen planificat pentru fiecare etapă și data la care s-a terminat. O etapă cu termenul depășit și nerealizată marchează proiectul
        cu roșu. Când muți proiectul pe un stadiu nou, etapele dinainte primesc automat data de azi.
      </p>
      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr className="[&>th]:h-9 [&>th]:px-3 [&>th]:text-left [&>th]:font-medium [&>th]:whitespace-nowrap">
                <th>Etapă</th>
                <th>Termen planificat</th>
                <th>Realizat la</th>
                <th>Situație</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stages.map((stage, index) => {
                const d = byStage.get(stage.id);
                const planned = d?.planned_date ?? null;
                const completed = d?.completed_date ?? null;
                const overdue = !completed && planned && planned < today;
                const dueToday = !completed && planned === today;
                const current = stage.id === currentStageId;
                return (
                  <tr
                    key={stage.id}
                    className={cn("border-t [&>td]:px-3 [&>td]:py-2", overdue && "bg-danger-soft", current && !overdue && "bg-accent/50")}
                  >
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                        <span className="size-2 rounded-full" style={{ backgroundColor: stage.color }} />
                        <span className={cn(current && "font-semibold")}>{stage.name}</span>
                        {current ? <span className="text-[11px] text-muted-foreground">(acum)</span> : null}
                      </span>
                    </td>
                    <td>
                      <DateField
                        value={planned}
                        onChange={(v) => save(stage.id, { planned_date: v })}
                        className="h-8 w-40"
                        aria-label={`Termen ${stage.name}`}
                      />
                    </td>
                    <td>
                      <DateField
                        value={completed}
                        onChange={(v) => save(stage.id, { completed_date: v })}
                        className="h-8 w-40"
                        aria-label={`Realizat ${stage.name}`}
                      />
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      {completed ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckIcon className="size-3.5" /> gata
                          {planned && completed > planned ? (
                            <span className="text-muted-foreground">(+{daysBetween(planned, completed)} zile)</span>
                          ) : null}
                        </span>
                      ) : overdue ? (
                        <span className="font-medium text-destructive">întârziat {daysBetween(planned!, today)} zile</span>
                      ) : dueToday ? (
                        <span className="font-medium text-warning">termen azi</span>
                      ) : planned ? (
                        <span className="text-muted-foreground">în {daysBetween(today, planned)} zile</span>
                      ) : (
                        <span className="text-muted-foreground/60">fără termen</span>
                      )}
                    </td>
                    <td className="text-right">
                      {!completed ? (
                        <Button variant="ghost" size="xs" onClick={() => save(stage.id, { completed_date: today })}>
                          <CheckIcon /> Gata azi
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
