"use client";

import { useCallback, useDeferredValue, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, DownloadIcon, PlusIcon, SearchIcon, Trash2Icon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatDateTime } from "@/lib/format";
import { fold, formatPhone, websiteHref, websiteLabel } from "@/lib/leads/normalize";
import type { Lead } from "@/lib/leads/types";
import type { LeadSource, LeadStatus } from "@/lib/types";
import { dropSearchParam } from "@/lib/url";
import { cn } from "@/lib/utils";
import { deleteLead, updateLead } from "./actions";
import { AddLeadDialog } from "./add-lead-dialog";
import { FollowUpCell, followUpState, InlineText, SourceMenu, StatusMenu } from "./cells";
import { exportLeadsCsv } from "./export";
import { LeadSheet } from "./lead-sheet";

type SortKey = "company_name" | "status" | "source" | "follow_up_date" | "updated_at" | "created_at";
type FollowFilter = "all" | "due" | "today" | "week" | "none";

const FOLLOW_LABELS: Record<FollowFilter, string> = {
  all: "Orice follow-up",
  due: "Azi și restante",
  today: "Doar azi",
  week: "Următoarele 7 zile",
  none: "Fără dată de follow-up",
};

const PAGE_SIZE = 100;
const ALL = "all";
const NO_SOURCE = "none";

export function LeadsView({
  initialLeads,
  statuses,
  sources,
  today,
  weekEnd,
  leadProjects,
  canCreateProject,
}: {
  leadProjects: Record<string, string>;
  canCreateProject: boolean;
  initialLeads: Lead[];
  statuses: LeadStatus[];
  sources: LeadSource[];
  today: string;
  weekEnd: string;
}) {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState(initialLeads);
  const [tab, setTabState] = useState(() => {
    const fromUrl = searchParams.get("status");
    return fromUrl && statuses.some((s) => s.id === fromUrl) ? fromUrl : ALL;
  });
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sourceFilter, setSourceFilterState] = useState(() => {
    const fromUrl = searchParams.get("sursa");
    return fromUrl && (fromUrl === NO_SOURCE || sources.some((s) => s.id === fromUrl)) ? fromUrl : ALL;
  });
  const [followFilter, setFollowFilter] = useState<FollowFilter>(() => {
    const fromUrl = searchParams.get("follow");
    return fromUrl === "due" || fromUrl === "today" || fromUrl === "week" || fromUrl === "none" ? fromUrl : "all";
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "created_at", dir: "desc" });
  const [page, setPage] = useState(0);
  // ?lead=<id> deschide direct fișa (link din calendar / proiect).
  const [openId, setOpenId] = useState<string | null>(() => searchParams.get("lead"));
  // ?nou=1 (din butonul „+” / ⌘K) deschide direct formularul.
  const [addOpen, setAddOpen] = useState(() => searchParams.get("nou") === "1");
  const [, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<Lead | null>(null);
  const [deleting, startDelete] = useTransition();

  // Dacă serverul trimite date noi (ex. după import), le preluăm.
  const [prevInitial, setPrevInitial] = useState(initialLeads);
  if (initialLeads !== prevInitial) {
    setPrevInitial(initialLeads);
    setLeads(initialLeads);
  }

  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  function setTab(value: string) {
    setTabState(value);
    setPage(0);
    const url = new URL(window.location.href);
    if (value === ALL) url.searchParams.delete("status");
    else url.searchParams.set("status", value);
    window.history.replaceState(null, "", url);
  }

  function setSourceFilter(value: string) {
    setSourceFilterState(value);
    setPage(0);
    const url = new URL(window.location.href);
    if (value === ALL) url.searchParams.delete("sursa");
    else url.searchParams.set("sursa", value);
    window.history.replaceState(null, "", url);
  }

  const searchIndex = useMemo(
    () =>
      new Map(
        leads.map((l) => [
          l.id,
          fold(
            [l.company_name, l.website, l.owner_name, l.email, l.phone1, l.phone2, l.called_by, l.potential, l.notes]
              .filter(Boolean)
              .join(" "),
          ),
        ]),
      ),
    [leads],
  );

  // Căutarea și filtrul de follow-up (fără taburi) — din ele se calculează numerele de pe taburi.
  const baseFiltered = useMemo(() => {
    const terms = fold(deferredSearch).split(/\s+/).filter(Boolean);
    // Căutarea după telefon ignoră spațiile: „0726 754” găsește „0726754999”.
    const digits = deferredSearch.replace(/\D/g, "");
    return leads.filter((l) => {
      if (terms.length) {
        const haystack = searchIndex.get(l.id) ?? "";
        const textMatch = terms.every((t) => haystack.includes(t));
        const phoneMatch = digits.length >= 4 && `${l.phone1 ?? ""} ${l.phone2 ?? ""}`.replace(/\D/g, "").includes(digits);
        if (!textMatch && !phoneMatch) return false;
      }
      if (followFilter !== "all") {
        const d = l.follow_up_date;
        const closed = statusById.get(l.status_id)?.is_closed ?? false;
        if (followFilter === "none") return !d;
        if (!d || closed) return false;
        if (followFilter === "due" && d > today) return false;
        if (followFilter === "today" && d !== today) return false;
        if (followFilter === "week" && (d < today || d > weekEnd)) return false;
      }
      return true;
    });
  }, [leads, deferredSearch, searchIndex, followFilter, statusById, today, weekEnd]);

  const matchesSource = useCallback(
    (l: Lead, source: string) => source === ALL || (source === NO_SOURCE ? l.source_id === null : l.source_id === source),
    [],
  );
  const filtered = useMemo(() => baseFiltered.filter((l) => matchesSource(l, sourceFilter)), [baseFiltered, matchesSource, sourceFilter]);

  // Numărul pe fiecare sursă, în tabul de status ales.
  const sourceCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of baseFiltered) {
      if (tab !== ALL && l.status_id !== tab) continue;
      const key = l.source_id ?? NO_SOURCE;
      map.set(key, (map.get(key) ?? 0) + 1);
      map.set(ALL, (map.get(ALL) ?? 0) + 1);
    }
    return map;
  }, [baseFiltered, tab]);
  // Sursele inactive apar doar dacă au lead-uri.
  const sourceTabs = sources.filter((s) => s.active || (sourceCounts.get(s.id) ?? 0) > 0 || sourceFilter === s.id);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of filtered) map.set(l.status_id, (map.get(l.status_id) ?? 0) + 1);
    return map;
  }, [filtered]);

  const rows = useMemo(() => {
    const inTab = tab === ALL ? filtered : filtered.filter((l) => l.status_id === tab);
    const dir = sort.dir === "asc" ? 1 : -1;
    const value = (l: Lead): string | number => {
      switch (sort.key) {
        case "company_name":
          return fold(l.company_name);
        case "status":
          return statusById.get(l.status_id)?.sort_order ?? 0;
        case "source":
          return fold(sourceById.get(l.source_id ?? "")?.name ?? "￿");
        case "follow_up_date":
          return l.follow_up_date ?? (sort.dir === "asc" ? "9999" : "0000");
        default:
          return l[sort.key];
      }
    };
    return [...inTab].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      return va < vb ? -dir : va > vb ? dir : 0;
    });
  }, [filtered, tab, sort, statusById, sourceById]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const save = useCallback(
    (id: string, patch: Partial<Lead>) => {
      const before = leads.find((l) => l.id === id);
      setLeads((current) => current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      startTransition(async () => {
        const result = await updateLead(id, patch);
        if (!result.ok) {
          toast.error(result.error);
          if (before) setLeads((current) => current.map((l) => (l.id === id ? before : l)));
          return;
        }
        setLeads((current) => current.map((l) => (l.id === id ? result.data : l)));
        if (patch.status_id && result.data.follow_up_date && result.data.follow_up_date !== before?.follow_up_date) {
          toast.success(`Follow-up setat pe ${formatDate(result.data.follow_up_date)}`);
        }
      });
    },
    [leads],
  );

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "company_name" ? "asc" : "desc" },
    );
  }

  const hasFilters = search || followFilter !== "all";

  function confirmDelete() {
    const lead = toDelete;
    if (!lead) return;
    startDelete(async () => {
      const result = await deleteLead(lead.id);
      if (result.ok) {
        setLeads((current) => current.filter((l) => l.id !== lead.id));
        setToDelete(null);
        toast.success("Lead șters");
      } else toast.error(result.error);
    });
  }
  const openLead = openId ? (leads.find((l) => l.id === openId) ?? null) : null;

  return (
    <div className="grid gap-4">
      {/* Taburi pe status */}
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 border-b">
          <TabButton active={tab === ALL} onClick={() => setTab(ALL)} label="Toate" count={filtered.length} />
          {statuses.map((s) => (
            <TabButton
              key={s.id}
              active={tab === s.id}
              onClick={() => setTab(s.id)}
              label={s.name}
              count={counts.get(s.id) ?? 0}
              color={s.color}
            />
          ))}
        </div>
      </div>

      {/* Taburi pe sursă */}
      <div className="-mx-3 -mt-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-1.5">
          <SourceTab active={sourceFilter === ALL} onClick={() => setSourceFilter(ALL)} label="Toate sursele" count={sourceCounts.get(ALL) ?? 0} />
          {sourceTabs.map((s) => (
            <SourceTab
              key={s.id}
              active={sourceFilter === s.id}
              onClick={() => setSourceFilter(s.id)}
              label={s.name}
              count={sourceCounts.get(s.id) ?? 0}
            />
          ))}
          {(sourceCounts.get(NO_SOURCE) ?? 0) > 0 || sourceFilter === NO_SOURCE ? (
            <SourceTab
              active={sourceFilter === NO_SOURCE}
              onClick={() => setSourceFilter(NO_SOURCE)}
              label="Fără sursă"
              count={sourceCounts.get(NO_SOURCE) ?? 0}
            />
          ) : null}
        </div>
      </div>

      {/* Filtre și acțiuni */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Caută companie, site, telefon, notițe…"
            className="pl-8"
          />
        </div>
        <Select
          value={followFilter}
          onValueChange={(v) => {
            setFollowFilter(v as FollowFilter);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-auto min-w-40">
            <SelectValue>{FOLLOW_LABELS[followFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{FOLLOW_LABELS.all}</SelectItem>
            <SelectItem value="due">{FOLLOW_LABELS.due}</SelectItem>
            <SelectItem value="today">{FOLLOW_LABELS.today}</SelectItem>
            <SelectItem value="week">{FOLLOW_LABELS.week}</SelectItem>
            <SelectItem value="none">{FOLLOW_LABELS.none}</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFollowFilter("all");
            }}
          >
            <XIcon /> Resetează
          </Button>
        ) : null}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => exportLeadsCsv(rows, statusById, sourceById)}>
          <DownloadIcon /> Export CSV
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/leaduri/import">
            <UploadIcon /> Import
          </Link>
        </Button>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PlusIcon /> Adaugă lead
        </Button>
      </div>

      {/* Tabel */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr className="[&>th]:h-9 [&>th]:px-2 [&>th]:text-left [&>th]:font-medium [&>th]:whitespace-nowrap">
                <SortHeader
                  label="Companie"
                  sortKey="company_name"
                  sort={sort}
                  onSort={toggleSort}
                  className="sticky left-0 z-10 bg-muted min-w-52"
                />
                <th className="min-w-36">Website</th>
                <th className="min-w-36">Owner</th>
                <th className="min-w-32">Telefon</th>
                <th className="min-w-44">Email</th>
                <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                <SortHeader label="Sursă" sortKey="source" sort={sort} onSort={toggleSort} />
                <SortHeader label="Follow-up" sortKey="follow_up_date" sort={sort} onSort={toggleSort} className="min-w-32" />
                <th className="min-w-28">Sunat de</th>
                <th className="min-w-56">Informații</th>
                <SortHeader label="Actualizat" sortKey="updated_at" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((lead) => {
                const status = statusById.get(lead.status_id);
                const state = followUpState(lead.follow_up_date, status?.is_closed ?? false, today);
                const href = websiteHref(lead.website);
                // Culori opace (amestec cu fundalul cardului), ca prima coloană fixă să nu lase textul să se vadă prin ea.
                const rowTone =
                  state === "overdue"
                    ? "bg-[color-mix(in_oklab,var(--danger-soft)_60%,var(--card))]"
                    : state === "today"
                      ? "bg-[color-mix(in_oklab,var(--warning-soft)_75%,var(--card))]"
                      : "bg-card";
                return (
                  <tr key={lead.id} className={cn("group border-t [&>td]:px-1 [&>td]:py-1 [&>td]:align-middle", rowTone)}>
                    <td className={cn("sticky left-0 z-10 max-w-64", rowTone)}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left font-medium hover:underline"
                          onClick={() => setOpenId(lead.id)}
                          title={lead.company_name}
                        >
                          {lead.company_name}
                        </button>
                        {lead.is_seed ? <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">test</span> : null}
                        <button
                          type="button"
                          onClick={() => setToDelete(lead)}
                          className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 [@media(hover:none)]:opacity-60"
                          aria-label={`Șterge ${lead.company_name}`}
                          title="Șterge lead"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="max-w-44">
                      <div className="flex items-center">
                        <InlineText
                          label="website"
                          value={lead.website}
                          onSave={(v) => save(lead.id, { website: v })}
                          display={<span className="text-muted-foreground">{websiteLabel(lead.website)}</span>}
                        />
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="px-1 text-xs text-muted-foreground hover:text-foreground"
                            aria-label="Deschide site-ul"
                          >
                            ↗
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-44">
                      <InlineText label="owner" value={lead.owner_name} onSave={(v) => save(lead.id, { owner_name: v })} />
                    </td>
                    <td className="max-w-40">
                      <div className="flex items-center">
                        <InlineText
                          label="telefon"
                          value={lead.phone1}
                          onSave={(v) => save(lead.id, { phone1: v })}
                          display={<span className="tabular-nums">{formatPhone(lead.phone1)}</span>}
                        />
                        {lead.phone2 ? (
                          <span className="px-1 text-[11px] text-muted-foreground" title={formatPhone(lead.phone2)}>
                            +1
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-52">
                      <InlineText label="email" value={lead.email} onSave={(v) => save(lead.id, { email: v })} />
                    </td>
                    <td className="px-2!">
                      <StatusMenu statuses={statuses} value={lead.status_id} onChange={(id) => save(lead.id, { status_id: id })} />
                    </td>
                    <td>
                      <SourceMenu sources={sources} value={lead.source_id} onChange={(id) => save(lead.id, { source_id: id })} />
                    </td>
                    <td>
                      <FollowUpCell value={lead.follow_up_date} state={state} onSave={(v) => save(lead.id, { follow_up_date: v })} />
                    </td>
                    <td className="max-w-32">
                      <InlineText label="sunat de" value={lead.called_by} onSave={(v) => save(lead.id, { called_by: v })} />
                    </td>
                    <td className="max-w-72">
                      <InlineText
                        label="informații"
                        value={lead.notes}
                        onSave={(v) => save(lead.id, { notes: v })}
                        display={<span className="text-muted-foreground">{lead.notes?.replace(/\s+/g, " ")}</span>}
                      />
                    </td>
                    <td className="px-2! text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDateTime(lead.updated_at)}
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {leads.length === 0 ? (
                      <>
                        Nu ai încă lead-uri.{" "}
                        <Link href="/leaduri/import" className="font-medium text-foreground underline underline-offset-4">
                          Importă din CSV/Excel
                        </Link>{" "}
                        sau adaugă unul manual.
                      </>
                    ) : (
                      "Niciun lead nu corespunde filtrelor."
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>
            {rows.length} {rows.length === 1 ? "lead" : "lead-uri"}
            {rows.length > PAGE_SIZE ? ` · ${currentPage * PAGE_SIZE + 1}–${Math.min(rows.length, (currentPage + 1) * PAGE_SIZE)}` : ""}
          </span>
          <span className="hidden items-center gap-3 sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm border bg-warning-soft" /> follow-up azi
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm border bg-danger-soft" /> restant
            </span>
          </span>
          {pageCount > 1 ? (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="xs" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                Înapoi
              </Button>
              <span className="px-2">
                {currentPage + 1} / {pageCount}
              </span>
              <Button variant="outline" size="xs" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>
                Înainte
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <LeadSheet
        lead={openLead}
        statuses={statuses}
        sources={sources}
        today={today}
        leadProjects={leadProjects}
        canCreateProject={canCreateProject}
        onClose={() => {
          setOpenId(null);
          if (searchParams.get("lead")) {
            const url = new URL(window.location.href);
            url.searchParams.delete("lead");
            window.history.replaceState(null, "", url);
          }
        }}
        onSave={save}
        onDeleted={(id) => {
          setLeads((current) => current.filter((l) => l.id !== id));
          setOpenId(null);
        }}
      />

      <ConfirmDeleteDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setToDelete(null);
        }}
        title="Ștergi lead-ul?"
        description={
          <>
            <b className="text-foreground">{toDelete?.company_name}</b> și istoricul lui de status vor fi șterse definitiv.
          </>
        }
        confirmLabel="Șterge lead"
        pending={deleting}
        onConfirm={confirmDelete}
      />

      <AddLeadDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) dropSearchParam("nou");
        }}
        statuses={statuses}
        sources={sources}
        defaultStatusId={tab !== ALL ? tab : undefined}
        onCreated={(lead) => {
          setLeads((current) => [lead, ...current]);
          setOpenId(lead.id);
        }}
        onOpenExisting={(id) => {
          setAddOpen(false);
          setOpenId(id);
        }}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
        active && "border-brand text-foreground",
      )}
    >
      {color ? <span className="size-2 rounded-full" style={{ backgroundColor: color }} /> : null}
      {label}
      <span className={cn("rounded-full bg-muted px-1.5 text-[11px] leading-5 tabular-nums", active && "bg-accent text-accent-foreground")}>
        {count}
      </span>
    </button>
  );
}

function SourceTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground",
        active && "border-primary bg-primary text-primary-foreground hover:border-primary hover:text-primary-foreground",
      )}
    >
      {label}
      <span className={cn("text-xs tabular-nums opacity-60", active && "opacity-80")}>{count}</span>
    </button>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDownIcon : sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(sortKey)}>
        {label}
        <Icon className={cn("size-3", !active && "opacity-40")} />
      </button>
    </th>
  );
}
