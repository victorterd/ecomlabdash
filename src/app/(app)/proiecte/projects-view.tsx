"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertTriangleIcon, CalendarClockIcon, KanbanSquareIcon, PlusIcon, SearchIcon, TableIcon, UsersRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { StageMenu } from "@/components/stage-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDate, formatPercent, formatRON } from "@/lib/format";
import { fold } from "@/lib/leads/normalize";
import { projectHealth, type ProjectHealth } from "@/lib/projects/health";
import { projectMoney, type ProjectMoney } from "@/lib/projects/money";
import { PROJECT_TYPE_LABEL, type Project, type ProjectFinance, type StageDeadline, type Transaction } from "@/lib/projects/types";
import type { ProjectStage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { moveProject } from "./actions";

type View = "kanban" | "tabel";

type Row = { project: Project; health: ProjectHealth; money: ProjectMoney | null; actors: number };

export function ProjectsView({
  initialProjects,
  deadlines: initialDeadlines,
  finance,
  transactions,
  actorCounts,
  stages,
  today,
  warningDays,
  isAdmin,
}: {
  initialProjects: Project[];
  deadlines: StageDeadline[];
  finance: ProjectFinance[];
  transactions: Transaction[];
  actorCounts: Record<string, number>;
  stages: ProjectStage[];
  today: string;
  warningDays: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setViewState] = useState<View>(searchParams.get("v") === "tabel" ? "tabel" : "kanban");
  const [projects, setProjects] = useState(initialProjects);
  const [deadlines, setDeadlines] = useState(initialDeadlines);
  const [prev, setPrev] = useState({ initialProjects, initialDeadlines });
  if (prev.initialProjects !== initialProjects || prev.initialDeadlines !== initialDeadlines) {
    setPrev({ initialProjects, initialDeadlines });
    setProjects(initialProjects);
    setDeadlines(initialDeadlines);
  }
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [, startTransition] = useTransition();

  function setView(next: View) {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next === "kanban") url.searchParams.delete("v");
    else url.searchParams.set("v", next);
    window.history.replaceState(null, "", url);
  }

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const deadlinesByProject = useMemo(() => {
    const map = new Map<string, StageDeadline[]>();
    for (const d of deadlines) map.set(d.project_id, [...(map.get(d.project_id) ?? []), d]);
    return map;
  }, [deadlines]);
  const financeByProject = useMemo(() => new Map(finance.map((f) => [f.project_id, f])), [finance]);
  const txByProject = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) if (t.project_id) map.set(t.project_id, [...(map.get(t.project_id) ?? []), t]);
    return map;
  }, [transactions]);

  const rows: Row[] = useMemo(() => {
    const terms = fold(search).split(/\s+/).filter(Boolean);
    return projects
      .filter((p) => showArchived || !p.archived)
      .filter((p) => {
        if (!terms.length) return true;
        const hay = fold([p.client_name, p.description, p.contact_name, p.notes].filter(Boolean).join(" "));
        return terms.every((t) => hay.includes(t));
      })
      .map((p) => ({
        project: p,
        health: projectHealth(p, deadlinesByProject.get(p.id) ?? [], stageById, today, warningDays),
        money: isAdmin ? projectMoney(financeByProject.get(p.id)?.contract_value, txByProject.get(p.id) ?? []) : null,
        actors: actorCounts[p.id] ?? 0,
      }));
  }, [
    projects,
    showArchived,
    search,
    deadlinesByProject,
    stageById,
    today,
    warningDays,
    isAdmin,
    financeByProject,
    txByProject,
    actorCounts,
  ]);

  const lateCount = rows.filter((r) => r.health.level === "red").length;

  function move(projectId: string, stageId: string) {
    const project = projects.find((p) => p.id === projectId);
    if (!project || project.current_stage_id === stageId) return;
    const position = Math.max(0, ...projects.filter((p) => p.current_stage_id === stageId).map((p) => p.board_position)) + 1000;
    const before = projects;
    setProjects((current) => current.map((p) => (p.id === projectId ? { ...p, current_stage_id: stageId, board_position: position } : p)));
    startTransition(async () => {
      const result = await moveProject(projectId, stageId, position);
      if (!result.ok) {
        toast.error(result.error);
        setProjects(before);
        return;
      }
      setDeadlines((current) => [...current.filter((d) => d.project_id !== projectId), ...result.data]);
      toast.success(`${project.client_name} → ${stageById.get(stageId)?.name}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-muted p-1">
          <ViewButton active={view === "kanban"} onClick={() => setView("kanban")} icon={<KanbanSquareIcon />} label="Kanban" />
          <ViewButton active={view === "tabel"} onClick={() => setView("tabel")} icon={<TableIcon />} label="Tabel" />
        </div>
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută client, descriere…" className="pl-8" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
          Arată arhivate
        </label>
        {lateCount ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-danger-soft px-2 py-1 text-xs font-medium text-destructive">
            <AlertTriangleIcon className="size-3.5" /> {lateCount} {lateCount === 1 ? "proiect întârziat" : "proiecte întârziate"}
          </span>
        ) : null}
        <div className="flex-1" />
        <Button size="sm" asChild>
          <Link href="/proiecte/nou">
            <PlusIcon /> Proiect nou
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center text-sm text-muted-foreground">
          Nu ai încă proiecte. Creează unul nou sau deschide un lead câștigat și apasă „Creează proiect”.
        </div>
      ) : view === "kanban" ? (
        <Kanban rows={rows} stages={stages} isAdmin={isAdmin} today={today} onMove={move} />
      ) : (
        <ProjectsTable rows={rows} stages={stages} isAdmin={isAdmin} onMove={move} />
      )}
    </div>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground [&_svg]:size-4",
        active && "bg-card text-foreground shadow-sm",
      )}
    >
      {icon} {label}
    </button>
  );
}

// ---------------------------------------------------------------------
// Kanban
// ---------------------------------------------------------------------

function Kanban({
  rows,
  stages,
  isAdmin,
  today,
  onMove,
}: {
  rows: Row[];
  stages: ProjectStage[];
  isAdmin: boolean;
  today: string;
  onMove: (projectId: string, stageId: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const columns = stages.map((stage) => ({
    stage,
    rows: rows.filter((r) => r.project.current_stage_id === stage.id).sort((a, b) => a.project.board_position - b.project.board_position),
  }));
  const withoutStage = rows.filter((r) => !r.project.current_stage_id || !stages.some((s) => s.id === r.project.current_stage_id));
  const active = rows.find((r) => r.project.id === activeId);

  return (
    <DndContext
      id="projects-kanban"
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={(e: DragEndEvent) => {
        setActiveId(null);
        if (e.over) onMove(String(e.active.id), String(e.over.id));
      }}
    >
      <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-3">
          {columns.map(({ stage, rows: columnRows }) => (
            <KanbanColumn key={stage.id} stage={stage} rows={columnRows} isAdmin={isAdmin} today={today} />
          ))}
        </div>
      </div>
      {withoutStage.length ? (
        <p className="text-xs text-muted-foreground">
          {withoutStage.length} proiecte fără stadiu (stadiul a fost șters): {withoutStage.map((r) => r.project.client_name).join(", ")}
        </p>
      ) : null}
      <DragOverlay>{active ? <ProjectCard row={active} isAdmin={isAdmin} today={today} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({ stage, rows, isAdmin, today }: { stage: ProjectStage; rows: Row[]; isAdmin: boolean; today: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = isAdmin ? rows.reduce((sum, r) => sum + (r.money?.contractValue.toNumber() ?? 0), 0) : 0;
  return (
    <div
      ref={setNodeRef}
      className={cn("flex w-64 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors", isOver && "border-brand bg-accent/60")}
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="text-sm font-semibold">{stage.name}</span>
        <span className="rounded-full bg-card px-1.5 text-[11px] leading-5 text-muted-foreground tabular-nums">{rows.length}</span>
        <span className="flex-1" />
        {isAdmin && total > 0 ? <span className="text-[11px] text-muted-foreground tabular-nums">{formatRON(total)}</span> : null}
      </div>
      <div className="flex min-h-24 flex-col gap-2 p-2 pt-0">
        {rows.map((row) => (
          <DraggableCard key={row.project.id} row={row} isAdmin={isAdmin} today={today} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ row, isAdmin, today }: { row: Row; isAdmin: boolean; today: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.project.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-40")}>
      <ProjectCard row={row} isAdmin={isAdmin} today={today} />
    </div>
  );
}

function ProjectCard({ row, isAdmin, today, overlay }: { row: Row; isAdmin: boolean; today: string; overlay?: boolean }) {
  const { project, health, money } = row;
  return (
    <div
      className={cn(
        "grid cursor-grab gap-2 rounded-lg border bg-card p-3 text-sm shadow-xs",
        health.level === "red" && "border-l-4 border-l-destructive",
        health.level === "yellow" && "border-l-4 border-l-warning",
        project.archived && "opacity-60",
        overlay && "rotate-1 cursor-grabbing shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/proiecte/${project.id}`}
          className="font-semibold leading-snug hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {project.client_name}
        </Link>
        {project.type === "retainer" ? <Badge variant="secondary">Retainer</Badge> : null}
      </div>
      {project.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{project.description}</p> : null}
      <HealthLine health={health} deadline={project.deadline} today={today} />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {row.actors ? (
          <span className="inline-flex items-center gap-1">
            <UsersRoundIcon className="size-3.5" /> {row.actors}
          </span>
        ) : null}
        <span className="flex-1" />
        {isAdmin && money && !money.contractValue.isZero() ? (
          <span className="font-medium text-foreground tabular-nums">{formatRON(money.contractValue)}</span>
        ) : null}
      </div>
    </div>
  );
}

function HealthLine({ health, deadline, today }: { health: ProjectHealth; deadline: string | null; today: string }) {
  if (health.delivered) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {deadline ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
            health.deadlinePassed
              ? "bg-danger-soft text-destructive"
              : health.deadlineSoon
                ? "bg-warning-soft text-warning"
                : "bg-muted text-muted-foreground",
          )}
        >
          <CalendarClockIcon className="size-3" />
          {formatDate(deadline)}
          {deadline === today ? " (azi)" : ""}
        </span>
      ) : null}
      {health.overdueStages.length ? (
        <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-1.5 py-0.5 text-destructive">
          <AlertTriangleIcon className="size-3" />
          {health.overdueStages.length === 1 ? "1 etapă întârziată" : `${health.overdueStages.length} etape întârziate`}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
// Tabel
// ---------------------------------------------------------------------

function ProjectsTable({
  rows,
  stages,
  isAdmin,
  onMove,
}: {
  rows: Row[];
  stages: ProjectStage[];
  isAdmin: boolean;
  onMove: (projectId: string, stageId: string) => void;
}) {
  const sorted = [...rows].sort((a, b) => {
    // Întârziate primele, apoi după deadline.
    const rank = (r: Row) => (r.health.level === "red" ? 0 : r.health.level === "yellow" ? 1 : r.health.delivered ? 3 : 2);
    return rank(a) - rank(b) || (a.project.deadline ?? "9999").localeCompare(b.project.deadline ?? "9999");
  });

  return (
    <div className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr className="[&>th]:h-9 [&>th]:px-3 [&>th]:text-left [&>th]:font-medium [&>th]:whitespace-nowrap">
              <th>Client</th>
              <th>Ce s-a vândut</th>
              <th>Stadiu</th>
              <th>Start</th>
              <th>Deadline</th>
              {isAdmin ? (
                <>
                  <th className="text-right!">Valoare</th>
                  <th className="text-right!">Încasat</th>
                  <th className="text-right!">De încasat</th>
                  <th className="text-right!">Profit</th>
                  <th className="text-right!">Marjă</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ project, health, money }) => (
              <tr
                key={project.id}
                className={cn(
                  "border-t [&>td]:px-3 [&>td]:py-2",
                  health.level === "red" && "bg-danger-soft",
                  health.level === "yellow" && "bg-warning-soft",
                  project.archived && "text-muted-foreground",
                )}
              >
                <td className="max-w-56">
                  <Link href={`/proiecte/${project.id}`} className="font-medium hover:underline">
                    {project.client_name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {PROJECT_TYPE_LABEL[project.type]}
                    {project.archived ? " · arhivat" : ""}
                  </div>
                </td>
                <td className="max-w-64 truncate text-muted-foreground" title={project.description ?? undefined}>
                  {project.description}
                </td>
                <td>
                  <StageMenu stages={stages} value={project.current_stage_id} onChange={(id) => onMove(project.id, id)} />
                  {health.overdueStages.length ? (
                    <div className="mt-0.5 text-[11px] text-destructive">{health.overdueStages.length} etape întârziate</div>
                  ) : null}
                </td>
                <td className="whitespace-nowrap tabular-nums">{formatDate(project.start_date)}</td>
                <td
                  className={cn(
                    "whitespace-nowrap tabular-nums",
                    health.deadlinePassed && "font-semibold text-destructive",
                    health.deadlineSoon && "font-semibold text-warning",
                  )}
                >
                  {formatDate(project.deadline)}
                </td>
                {isAdmin && money ? (
                  <>
                    <td className="text-right whitespace-nowrap tabular-nums">{formatRON(money.contractValue)}</td>
                    <td className="text-right whitespace-nowrap tabular-nums">{formatRON(money.received)}</td>
                    <td className="text-right whitespace-nowrap tabular-nums">{formatRON(money.toReceive)}</td>
                    <td className={cn("text-right whitespace-nowrap tabular-nums", money.profit.isNegative() && "text-destructive")}>
                      {formatRON(money.profit)}
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {money.margin ? formatPercent(money.margin.toFixed(1)) : "—"}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 5} className="px-4 py-10 text-center text-muted-foreground">
                  Niciun proiect nu corespunde filtrelor.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
