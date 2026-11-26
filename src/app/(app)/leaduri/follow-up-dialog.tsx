"use client";

import { useState, useTransition } from "react";
import { addDays, format, parseISO } from "date-fns";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/date-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, parseTimeInput } from "@/lib/format";
import type { Lead } from "@/lib/leads/types";
import type { LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { logFollowUp } from "./actions";

export type FollowUpSettings = { followUpDays: number; defaultTime: string };

const plus = (today: string, days: number) => format(addDays(parseISO(today), days), "yyyy-MM-dd");

/**
 * „Am făcut follow-up”: ce s-a întâmplat (status), o notiță și când e următorul.
 * Se salvează în istoricul lead-ului.
 */
export function FollowUpDialog({
  lead,
  open,
  onOpenChange,
  statuses,
  settings,
  today,
  onSaved,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: LeadStatus[];
  settings: FollowUpSettings;
  today: string;
  onSaved: (lead: Lead) => void;
}) {
  return (
    <Dialog open={open && lead !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {lead ? (
          <FollowUpForm
            key={lead.id}
            lead={lead}
            statuses={statuses}
            settings={settings}
            today={today}
            onCancel={() => onOpenChange(false)}
            onSaved={(saved) => {
              onOpenChange(false);
              onSaved(saved);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FollowUpForm({
  lead,
  statuses,
  settings,
  today,
  onCancel,
  onSaved,
}: {
  lead: Lead;
  statuses: LeadStatus[];
  settings: FollowUpSettings;
  today: string;
  onCancel: () => void;
  onSaved: (lead: Lead) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [statusId, setStatusId] = useState(lead.status_id);
  const [note, setNote] = useState("");
  const [doneOn, setDoneOn] = useState<string | null>(today);
  const defaultNext = (status: LeadStatus | undefined) => (status?.is_closed ? null : plus(today, settings.followUpDays));
  const [next, setNext] = useState<string | null>(() => defaultNext(statuses.find((s) => s.id === lead.status_id)));
  const [time, setTime] = useState(lead.follow_up_time?.slice(0, 5) ?? settings.defaultTime);
  const status = statuses.find((s) => s.id === statusId);

  const quick = [
    { label: "Mâine", value: plus(today, 1) },
    { label: "3 zile", value: plus(today, 3) },
    { label: "O săptămână", value: plus(today, 7) },
    { label: "2 săptămâni", value: plus(today, 14) },
    { label: "Fără", value: null },
  ];

  function save() {
    const parsedTime = parseTimeInput(time);
    if (parsedTime === undefined) return void toast.error("Ora nu e validă (ex. 10:00)");
    if (!doneOn) return void toast.error("Alege data la care ai făcut follow-up-ul");
    startTransition(async () => {
      const result = await logFollowUp(lead.id, {
        done_on: doneOn,
        note: note.trim() || null,
        status_id: statusId,
        next_follow_up: next,
        next_time: next ? parsedTime : null,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(next ? `Follow-up salvat · următorul pe ${formatDate(next)}` : "Follow-up salvat");
      onSaved(result.data);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Am făcut follow-up</DialogTitle>
        <DialogDescription>{lead.company_name}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Ce s-a întâmplat?</Label>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === statusId}
                onClick={() => {
                  setStatusId(s.id);
                  setNext(defaultNext(s));
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  s.id === statusId && "font-medium text-foreground",
                )}
                style={
                  s.id === statusId
                    ? { borderColor: s.color, backgroundColor: `color-mix(in oklab, ${s.color} 12%, var(--card))` }
                    : undefined
                }
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="followup-note">Notiță</Label>
          <Textarea
            id="followup-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ce ați vorbit, ce a zis, ce urmează…"
            rows={3}
            autoFocus
          />
        </div>

        <div className="grid gap-2">
          <Label>Următorul follow-up</Label>
          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setNext(q.value)}
                className={cn(
                  "h-8 rounded-full border bg-card px-3 text-sm text-muted-foreground hover:text-foreground",
                  next === q.value && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
          {next ? (
            <div className="flex gap-2">
              <DateField value={next} onChange={setNext} className="flex-1" aria-label="Data următorului follow-up" />
              <Input value={time} onChange={(e) => setTime(e.target.value)} className="w-24" aria-label="Ora" placeholder="10:00" />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {status?.is_closed ? `„${status.name}” închide lead-ul, nu mai e nevoie de follow-up.` : "Nu programez alt follow-up."}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Făcut pe</span>
          <DateField value={doneOn} onChange={(v) => setDoneOn(v && v <= today ? v : doneOn)} className="h-8 w-40" aria-label="Făcut pe" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Anulează
        </Button>
        <Button onClick={save} disabled={pending}>
          <CheckIcon /> Salvează
        </Button>
      </DialogFooter>
    </>
  );
}
