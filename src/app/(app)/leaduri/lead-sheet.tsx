"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRightIcon, ClapperboardIcon, ExternalLinkIcon, MailIcon, PhoneCallIcon, PhoneIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/confirm-dialog";
import { DateField } from "@/components/date-field";
import { ColorBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { formatPhone, websiteHref } from "@/lib/leads/normalize";
import type { Lead } from "@/lib/leads/types";
import type { LeadSource, LeadStatus } from "@/lib/types";
import { deleteLead, getLeadHistory, type LeadHistory } from "./actions";
import { FollowUpDialog, type FollowUpSettings } from "./follow-up-dialog";
import { SourceMenu, StatusMenu, followUpState } from "./cells";

export function LeadSheet({
  lead,
  statuses,
  sources,
  today,
  onClose,
  onSave,
  onDeleted,
  leadProjects,
  canCreateProject,
  followUpSettings,
  onFollowUpSaved,
}: {
  followUpSettings: FollowUpSettings;
  onFollowUpSaved: (lead: Lead) => void;
  leadProjects: Record<string, string>;
  canCreateProject: boolean;
  lead: Lead | null;
  statuses: LeadStatus[];
  sources: LeadSource[];
  today: string;
  onClose: () => void;
  onSave: (id: string, patch: Partial<Lead>) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <Sheet open={lead !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto p-0">
        {lead ? (
          <LeadDetails
            key={lead.id}
            lead={lead}
            statuses={statuses}
            sources={sources}
            today={today}
            onSave={onSave}
            onDeleted={onDeleted}
            projectId={leadProjects[lead.id] ?? null}
            canCreateProject={canCreateProject}
            followUpSettings={followUpSettings}
            onFollowUpSaved={onFollowUpSaved}
          />
        ) : (
          <SheetTitle className="sr-only">Lead</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}

function LeadDetails({
  lead,
  statuses,
  sources,
  today,
  onSave,
  onDeleted,
  projectId,
  canCreateProject,
  followUpSettings,
  onFollowUpSaved,
}: {
  followUpSettings: FollowUpSettings;
  onFollowUpSaved: (lead: Lead) => void;
  projectId: string | null;
  canCreateProject: boolean;
  lead: Lead;
  statuses: LeadStatus[];
  sources: LeadSource[];
  today: string;
  onSave: (id: string, patch: Partial<Lead>) => void;
  onDeleted: (id: string) => void;
}) {
  const [history, setHistory] = useState<LeadHistory | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [deleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = statuses.find((s) => s.id === lead.status_id);
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const state = followUpState(lead.follow_up_date, status?.is_closed ?? false, today);
  const save = (patch: Partial<Lead>) => onSave(lead.id, patch);

  // Istoricul se reîncarcă la fiecare schimbare de status.
  useEffect(() => {
    let cancelled = false;
    getLeadHistory(lead.id).then((result) => {
      if (!cancelled && result.ok) setHistory(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [lead.id, lead.status_id, historyVersion]);

  const field = (key: keyof Lead, label: string, props?: React.ComponentProps<typeof Input>) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`lead-${key}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`lead-${key}`}
        key={`${key}-${String(lead[key] ?? "")}`}
        defaultValue={String(lead[key] ?? "")}
        onBlur={(e) => {
          const next = e.target.value.trim() || null;
          if (next !== (lead[key] ?? null)) {
            if (key === "company_name" && !next) {
              e.target.value = lead.company_name;
              toast.error("Numele companiei e obligatoriu");
              return;
            }
            save({ [key]: next });
          }
        }}
        {...props}
      />
    </div>
  );

  const href = websiteHref(lead.website);

  return (
    <>
      <SheetHeader className="relative border-b pr-20">
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2.5 right-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Șterge lead"
          title="Șterge lead"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2Icon />
        </Button>
        <SheetTitle className="text-lg leading-snug">{lead.company_name}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {lead.phone1 ? (
            <a href={`tel:${lead.phone1.split(",")[0]}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <PhoneIcon className="size-3.5" /> {formatPhone(lead.phone1)}
            </a>
          ) : null}
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <MailIcon className="size-3.5" /> {lead.email}
            </a>
          ) : null}
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              <ExternalLinkIcon className="size-3.5" /> site
            </a>
          ) : null}
        </SheetDescription>
      </SheetHeader>

      <div className="grid gap-5 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <StatusMenu statuses={statuses} value={lead.status_id} onChange={(id) => save({ status_id: id })} className="w-fit" />
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Sursă</span>
            <SourceMenu sources={sources} value={lead.source_id} onChange={(id) => save({ source_id: id })} className="-ml-1.5" />
          </div>
        </div>

        {!status?.is_closed ? (
          <Button variant="outline" className="w-full justify-center" onClick={() => setFollowUpOpen(true)}>
            <PhoneCallIcon /> Am făcut follow-up
          </Button>
        ) : null}

        {projectId ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-brand/40 bg-accent px-3 py-2.5">
            <p className="text-sm font-medium text-accent-foreground">Are proiect creat.</p>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/proiecte/${projectId}`}>
                <ClapperboardIcon /> Vezi proiectul
              </Link>
            </Button>
          </div>
        ) : status?.is_won ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-brand/40 bg-accent px-3 py-2.5">
            <div className="text-sm">
              <p className="font-medium text-accent-foreground">Lead câștigat</p>
              <p className="text-xs text-muted-foreground">Creează proiectul cu datele clientului precompletate.</p>
            </div>
            {canCreateProject ? (
              <Button size="sm" asChild>
                <Link href={`/proiecte/nou?lead=${lead.id}`}>
                  <ClapperboardIcon /> Creează proiect
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Dată follow-up
              {state === "overdue" ? <span className="text-destructive">· restant</span> : null}
              {state === "today" ? <span className="text-warning">· azi</span> : null}
            </Label>
            <DateField value={lead.follow_up_date} onChange={(v) => save({ follow_up_date: v })} aria-label="Dată follow-up" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lead-follow_up_time" className="text-xs text-muted-foreground">
              Ora
            </Label>
            <Input
              id="lead-follow_up_time"
              key={`time-${lead.follow_up_time}`}
              defaultValue={formatTime(lead.follow_up_time)}
              placeholder="10:00"
              inputMode="numeric"
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (!raw) {
                  if (lead.follow_up_time) save({ follow_up_time: null });
                  return;
                }
                const match = raw.match(/^(\d{1,2})[:.]?(\d{2})?$/);
                const h = match ? Number(match[1]) : NaN;
                const m = match?.[2] ? Number(match[2]) : 0;
                if (!match || h > 23 || m > 59) {
                  toast.error("Ora trebuie să fie de forma 10:30");
                  e.target.value = formatTime(lead.follow_up_time);
                  return;
                }
                const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                e.target.value = value;
                if (value !== formatTime(lead.follow_up_time)) save({ follow_up_time: value });
              }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {field("company_name", "Nume companie")}
          {field("owner_name", "Owner (persoană de contact)")}
          {field("website", "Website")}
          {field("email", "Email", { type: "email" })}
          {field("phone1", "Telefon 1", { inputMode: "tel" })}
          {field("phone2", "Telefon 2", { inputMode: "tel" })}
          {field("called_by", "Cine l-a sunat")}
          {field("potential", "Potențial")}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="lead-notes" className="text-xs text-muted-foreground">
            Informații
          </Label>
          <Textarea
            id="lead-notes"
            key={`notes-${lead.notes}`}
            defaultValue={lead.notes ?? ""}
            rows={6}
            placeholder="Notițe despre discuții, ce vor, obiecții…"
            onBlur={(e) => {
              const next = e.target.value.trim() ? e.target.value : null;
              if (next !== (lead.notes ?? null)) save({ notes: next });
            }}
          />
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Istoric</h3>
          {history === null ? (
            <p className="text-xs text-muted-foreground">Se încarcă…</p>
          ) : history.statuses.length === 0 && history.activities.length === 0 ? (
            <p className="text-xs text-muted-foreground">Fără schimbări.</p>
          ) : (
            <ol className="grid gap-2.5">
              {[
                ...history.activities.map((a) => ({ key: `a-${a.id}`, at: `${a.done_on}T23:59:59|${a.created_at}`, activity: a })),
                ...history.statuses.map((h) => ({ key: `s-${h.id}`, at: h.changed_at, change: h })),
              ]
                .sort((x, y) => y.at.localeCompare(x.at))
                .map((entry) => {
                  if ("activity" in entry) {
                    const a = entry.activity;
                    const result = a.status_id ? statusById.get(a.status_id) : null;
                    return (
                      <li key={entry.key} className="grid gap-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <PhoneCallIcon className="size-3.5 text-muted-foreground" />
                          <span className="font-medium">Follow-up {formatDate(a.done_on)}</span>
                          {result ? <ColorBadge color={result.color}>{result.name}</ColorBadge> : null}
                          {a.next_follow_up ? (
                            <span className="text-muted-foreground">· următorul {formatDate(a.next_follow_up)}</span>
                          ) : null}
                        </div>
                        {a.note ? <p className="text-sm whitespace-pre-line">{a.note}</p> : null}
                      </li>
                    );
                  }
                  const h = entry.change;
                  const from = h.from_status_id ? statusById.get(h.from_status_id) : null;
                  const to = h.to_status_id ? statusById.get(h.to_status_id) : null;
                  return (
                    <li key={entry.key} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="w-28 shrink-0 text-muted-foreground tabular-nums">{formatDateTime(h.changed_at)}</span>
                      {from ? (
                        <>
                          <ColorBadge color={from.color}>{from.name}</ColorBadge>
                          <ArrowRightIcon className="size-3 text-muted-foreground" />
                        </>
                      ) : (
                        <span className="text-muted-foreground">creat ca</span>
                      )}
                      {to ? (
                        <ColorBadge color={to.color}>{to.name}</ColorBadge>
                      ) : (
                        <span className="text-muted-foreground">status șters</span>
                      )}
                    </li>
                  );
                })}
            </ol>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
          <span>
            Creat {formatDateTime(lead.created_at)} · modificat {formatDateTime(lead.updated_at)}
          </span>
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
            <Trash2Icon /> Șterge lead
          </Button>
        </div>
      </div>

      <FollowUpDialog
        lead={lead}
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        statuses={statuses}
        settings={followUpSettings}
        today={today}
        onSaved={(saved) => {
          onFollowUpSaved(saved);
          setHistoryVersion((v) => v + 1);
        }}
      />

      <ConfirmDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Ștergi lead-ul?"
        description={
          <>
            <b className="text-foreground">{lead.company_name}</b> și istoricul lui de status vor fi șterse definitiv.
          </>
        }
        confirmLabel="Șterge lead"
        pending={deleting}
        onConfirm={() =>
          startDelete(async () => {
            const result = await deleteLead(lead.id);
            if (result.ok) {
              setConfirmDelete(false);
              toast.success("Lead șters");
              onDeleted(lead.id);
            } else toast.error(result.error);
          })
        }
      />
    </>
  );
}
