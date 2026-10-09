"use client";

import { useState, useTransition } from "react";
import { AlertTriangleIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/date-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type DuplicateMatch, type Lead, MATCHED_ON_LABEL } from "@/lib/leads/types";
import type { LeadSource, LeadStatus } from "@/lib/types";
import { createLead } from "./actions";

const NO_SOURCE = "__none__";

export function AddLeadDialog({
  open,
  onOpenChange,
  statuses,
  sources,
  defaultStatusId,
  onCreated,
  onOpenExisting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: LeadStatus[];
  sources: LeadSource[];
  defaultStatusId?: string;
  onCreated: (lead: Lead) => void;
  onOpenExisting: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lead nou</DialogTitle>
          <DialogDescription>Doar numele companiei e obligatoriu. Restul le poți completa și după.</DialogDescription>
        </DialogHeader>
        {open ? (
          <AddLeadForm
            statuses={statuses}
            sources={sources}
            defaultStatusId={defaultStatusId}
            onCancel={() => onOpenChange(false)}
            onCreated={(lead) => {
              onOpenChange(false);
              onCreated(lead);
            }}
            onOpenExisting={onOpenExisting}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddLeadForm({
  statuses,
  sources,
  defaultStatusId,
  onCancel,
  onCreated,
  onOpenExisting,
}: {
  statuses: LeadStatus[];
  sources: LeadSource[];
  defaultStatusId?: string;
  onCancel: () => void;
  onCreated: (lead: Lead) => void;
  onOpenExisting: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [statusId, setStatusId] = useState(defaultStatusId ?? statuses.find((s) => s.is_default)?.id ?? statuses[0]?.id ?? "");
  const [sourceId, setSourceId] = useState(sources.find((s) => s.active)?.id ?? NO_SOURCE);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(form: HTMLFormElement, force: boolean) {
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "").trim() || null;
    const values = {
      company_name: text("company_name") ?? "",
      website: text("website"),
      owner_name: text("owner_name"),
      email: text("email"),
      phone1: text("phone1"),
      phone2: text("phone2"),
      called_by: text("called_by"),
      potential: null,
      notes: text("notes"),
      status_id: statusId,
      source_id: sourceId === NO_SOURCE ? null : sourceId,
      follow_up_date: followUp,
      follow_up_time: null,
    };
    setError(null);
    startTransition(async () => {
      const result = await createLead(values, force);
      if (result.ok) {
        toast.success("Lead adăugat");
        onCreated(result.data);
      } else if ("duplicate" in result) {
        setDuplicate(result.duplicate);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget, false);
      }}
      onChange={() => duplicate && setDuplicate(null)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="add-company">Nume companie *</Label>
          <Input id="add-company" name="company_name" required autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-website">Website</Label>
          <Input id="add-website" name="website" placeholder="exemplu.ro" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-owner">Owner</Label>
          <Input id="add-owner" name="owner_name" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-email">Email</Label>
          <Input id="add-email" name="email" type="email" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="add-phone1">Telefon 1</Label>
            <Input id="add-phone1" name="phone1" inputMode="tel" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="add-phone2">Telefon 2</Label>
            <Input id="add-phone2" name="phone2" inputMode="tel" />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select value={statusId} onValueChange={setStatusId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Sursă</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sources
                .filter((s) => s.active)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              <SelectItem value={NO_SOURCE}>Fără sursă</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-called">Cine l-a sunat</Label>
          <Input id="add-called" name="called_by" />
        </div>
        <div className="grid gap-1.5">
          <Label>Dată follow-up</Label>
          <DateField value={followUp} onChange={setFollowUp} aria-label="Dată follow-up" />
          {statuses.find((s) => s.id === statusId)?.is_follow_up && !followUp ? (
            <p className="text-xs text-muted-foreground">Gol = se setează automat din Setări.</p>
          ) : null}
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="add-notes">Informații</Label>
          <Textarea id="add-notes" name="notes" rows={3} />
        </div>
      </div>

      {duplicate ? (
        <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="grid gap-2">
            <p>
              Există deja <b>{duplicate.company_name}</b> cu {MATCHED_ON_LABEL[duplicate.matched_on]}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="xs" variant="outline" onClick={() => onOpenExisting(duplicate.lead_id)}>
                Deschide lead-ul existent
              </Button>
              <Button
                type="button"
                size="xs"
                variant="dark"
                disabled={pending}
                onClick={(e) => submit(e.currentTarget.closest("form")!, true)}
              >
                Adaugă oricum
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {error ? <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Renunță
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Adaugă lead
        </Button>
      </DialogFooter>
    </form>
  );
}
