"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  LayoutGridIcon,
  ListTodoIcon,
  PlusIcon,
  SearchIcon,
  TableIcon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDate, formatPercent, formatRON } from "@/lib/format";
import { fold } from "@/lib/leads/normalize";
import { daysBetween, projectHealth, sortTasks, type ProjectHealth } from "@/lib/projects/health";
import { projectMoney, type ProjectMoney } from "@/lib/projects/money";
import { PROJECT_TYPE_LABEL, type Project, type ProjectFinance, type ProjectTask, type Service, type Transaction } from "@/lib/projects/types";
import { cn } from "@/lib/utils";
import { updateTask } from "./actions";

type View = "carduri" | "tabel";

type Row = { project: Project; health: ProjectHealth; serviceIds: string[]; money: ProjectMoney | null; actors: number };

type TodoItem = { task: ProjectTask; project: Project; service: Service | undefined };

const TODO_PREVIEW = 8;

export function ProjectsView({
  initialProjects,
  tasks: initialTasks,
  projectServices,
  finance,
  transactions,
  actorCounts,
  services,
  today,
  warningDays,
  isAdmin,
}: {
  initialProjects: Project[];
  tasks: ProjectTask[];
  projectServices: { project_id: string; service_id: string }[];
  finance: ProjectFinance[];
  transactions: Transaction[];
  actorCounts: Record<string, number>;
  services: Service[];
  today: string;
  warningDays: number;
  isAdmin: boolean;
}) {
  const searchParams = useSearchParams();
  const [view, setViewState] = useState<View>(searchParams.get("v") === "tabel" ? "tabel" : "carduri");
  const [projects, setProjects] = useState(initialProjects);
  const [tasks, setTasks] = useState(initialTasks);
  const [prev, setPrev] = useState({ initialProjects, initialTasks });
  if (prev.initialProjects !== initialProjects || prev.initialTasks !== initialTasks) {
    setPrev({ initialProjects, initialTasks });
    setProjects(initialProjects);
    setTasks(initialTasks);
  }
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [allTodos, setAllTodos] = useState(false);
  const [, startTransition] = useTransition();

  function setView(next: View) {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next === "carduri") url.searchParams.delete("v");
    else url.searchParams.set("v", next);
    window.history.replaceState(null, "", url);
  }

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const tasksByProject = useMemo(() => {
    const map = new Map<string, ProjectTask[]>();
    for (const t of tasks) map.set(t.project_id, [...(map.get(t.project_id) ?? []), t]);
    for (const [id, list] of map) map.set(id, sortTasks(list, services));
    return map;
  }, [tasks, services]);
  const servicesByProject = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const ps of projectServices) map.set(ps.project_id, [...(map.get(ps.project_id) ?? []), ps.service_id]);
    for (const [id, list] of map) map.set(id, list.sort((a, b) => (serviceById.get(a)?.sort_order ?? 0) - (serviceById.get(b)?.sort_order ?? 0)));
    return map;
  }, [projectServices, serviceById]);
  const financeByProject = useMemo(() => new Map(finance.map((f) => [f.project_id, f])), [finance]);
  const txByProject = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) if (t.project_id) map.set(t.project_id, [...(map.get(t.project_id) ?? []), t]);
    return map;
  }, [transactions]);

  const rows: Row[] = useMemo(() => {
    const terms = fold(search).split(/\s+/).filter(Boolean);
    return projects
      .filter((p) => {
        if (!terms.length) return true;
        const hay = fold([p.client_name, p.description, p.contact_name, p.notes].filter(Boolean).join(" "));
        return terms.every((t) => hay.includes(t));
      })
      .map((p) => ({
        project: p,
        health: projectHealth(p, tasksByProject.get(p.id) ?? [], today, warningDays),
        serviceIds: servicesByProject.get(p.id) ?? [],
        money: isAdmin ? projectMoney(financeByProject.get(p.id)?.contract_value, txByProject.get(p.id) ?? []) : null,
        actors: actorCounts[p.id] ?? 0,
      }));
  }, [projects, search, tasksByProject, servicesByProject, today, warningDays, isAdmin, financeByProject, txByProject, actorCounts]);

  const active = rows
    .filter((r) => !r.health.delivered)
    .sort((a, b) => {
      // Întârziate primele, apoi după deadline.
      const rank = (r: Row) => (r.health.level === "red" ? 0 : r.health.level === "yellow" ? 1 : 2);
      return rank(a) - rank(b) || (a.project.deadline ?? "9999").localeCompare(b.project.deadline ?? "9999");
    });
  const done = rows.filter((r) => r.health.delivered);
  const lateCount = active.filter((r) => r.health.level === "red").length;

  // „De făcut”: următorul pas al fiecărui serviciu, pe proiectele în lucru.
  const todos: TodoItem[] = active
    .flatMap((r) =>
      r.health.byService
        .filter((s) => s.next)
        .map((s) => ({ task: s.next!, project: r.project, service: s.serviceId ? serviceById.get(s.serviceId) : undefined })),
    )
    .sort((a, b) => (a.task.due_date ?? "9999").localeCompare(b.task.due_date ?? "9999"));

  function tick(task: ProjectTask) {
    const before = tasks;
    setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, done_at: today } : t)));
    startTransition(async () => {
      const result = await updateTask(task.id, { done: true });
      if (!result.ok) {
        toast.error(result.error);
        setTasks(before);
        return;
      }
      setTasks((current) => [...current.filter((t) => t.project_id !== task.project_id), ...result.data.tasks]);
      setProjects((current) => current.map((p) => (p.id === task.project_id ? { ...p, delivered_at: result.data.deliveredAt } : p)));
      toast.success(result.data.deliveredAt ? "Ultimul pas bifat: proiect livrat 🎉" : `Bifat: ${task.title}`);
    });
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-muted p-1">
          <ViewButton active={view === "carduri"} onClick={() => setView("carduri")} icon={<LayoutGridIcon />} label="Carduri" />
          <ViewButton active={view === "tabel"} onClick={() => setView("tabel")} icon={<TableIcon />} label="Tabel" />
        </div>
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută client, descriere…" className="pl-8" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showDone} onCheckedChange={(v) => setShowDone(v === true)} />
          Arată livrate și arhivate
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
      ) : view === "tabel" ? (
        <ProjectsTable rows={showDone ? [...active, ...done] : active} serviceById={serviceById} isAdmin={isAdmin} />
      ) : (
        <>
          <section className="grid gap-3">
            <SectionTitle icon={<ListTodoIcon />} title="De făcut" count={todos.length} hint="Următorul pas pe fiecare proiect. Bifează-l când e gata." />
            {todos.length ? (
              <div className="surface overflow-hidden">
                <ul className="divide-y">
                  {(allTodos ? todos : todos.slice(0, TODO_PREVIEW)).map((item) => (
                    <TodoRow key={item.task.id} item={item} today={today} onTick={tick} />
                  ))}
                </ul>
                {todos.length > TODO_PREVIEW ? (
                  <button
                    type="button"
                    onClick={() => setAllTodos((v) => !v)}
                    className="w-full border-t bg-muted/30 px-4 py-2 text-left text-sm text-muted-foreground hover:text-foreground"
                  >
                    {allTodos ? "Arată mai puține" : `Arată toate (${todos.length})`}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nimic de făcut. Toate proiectele în lucru au pașii bifați.</p>
            )}
          </section>

          <section className="grid gap-3">
            <SectionTitle title="În lucru" count={active.length} />
            {active.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {active.map((row) => (
                  <ProjectCard key={row.project.id} row={row} serviceById={serviceById} isAdmin={isAdmin} today={today} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Niciun proiect în lucru.</p>
            )}
          </section>

          {showDone && done.length ? (
            <section className="grid gap-3">
              <SectionTitle title="Livrate și arhivate" count={done.length} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {done.map((row) => (
                  <ProjectCard key={row.project.id} row={row} serviceById={serviceById} isAdmin={isAdmin} today={today} />
                ))}
              </div>
            </section>
          ) : !showDone && done.length ? (
            <button type="button" onClick={() => setShowDone(true)} className="w-fit text-sm text-muted-foreground hover:text-foreground">
              + {done.length} {done.length === 1 ? "proiect livrat sau arhivat" : "proiecte livrate sau arhivate"}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, count, hint }: { icon?: React.ReactNode; title: string; count: number; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h2 className="flex items-center gap-2 text-lg font-semibold [&_svg]:size-5 [&_svg]:text-muted-foreground">
        {icon}
        {title}
      </h2>
      <span className="text-sm text-muted-foreground tabular-nums">{count}</span>
      {hint ? <span className="w-full text-xs text-muted-foreground sm:w-auto sm:pl-2">{hint}</span> : null}
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

function dueLabel(due: string | null, today: string): { text: string; tone: "late" | "today" | "normal" } {
  if (!due) return { text: "fără termen", tone: "normal" };
  if (due < today) return { text: `întârziat ${daysBetween(due, today)} zile`, tone: "late" };
  if (due === today) return { text: "azi", tone: "today" };
  const days = daysBetween(today, due);
  return { text: days === 1 ? "mâine" : `${formatDate(due)} · în ${days} zile`, tone: "normal" };
}

function TodoRow({ item, today, onTick }: { item: TodoItem; today: string; onTick: (task: ProjectTask) => void }) {
  const { task, project, service } = item;
  const due = dueLabel(task.due_date, today);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Checkbox className="size-5" checked={false} onCheckedChange={() => onTick(task)} aria-label={`Bifează ${task.title} la ${project.client_name}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{task.title}</div>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Link href={`/proiecte/${project.id}`} className="truncate hover:text-foreground hover:underline">
            {project.client_name}
          </Link>
          {service ? (
            <>
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: service.color }} />
              <span className="shrink-0">{service.name}</span>
            </>
          ) : null}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-xs whitespace-nowrap text-muted-foreground",
          due.tone === "late" && "font-medium text-destructive",
          due.tone === "today" && "font-medium text-warning",
        )}
      >
        {due.text}
      </span>
    </li>
  );
}

function ProjectCard({
  row,
  serviceById,
  isAdmin,
  today,
}: {
  row: Row;
  serviceById: Map<string, Service>;
  isAdmin: boolean;
  today: string;
}) {
  const { project, health, money } = row;
  // Serviciile alese, chiar dacă nu au încă pași.
  const lines = [
    ...row.serviceIds.map((id) => health.byService.find((b) => b.serviceId === id) ?? { serviceId: id, total: 0, done: 0, next: null }),
    ...health.byService.filter((b) => !b.serviceId || !row.serviceIds.includes(b.serviceId)),
  ];
  return (
    <Link
      href={`/proiecte/${project.id}`}
      className={cn(
        "surface grid content-start gap-3 p-4 text-sm transition-shadow hover:shadow-md",
        health.level === "red" && "border-l-4 border-l-destructive",
        health.level === "yellow" && "border-l-4 border-l-warning",
        health.delivered && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{project.client_name}</div>
          {project.description ? <p className="line-clamp-1 text-xs text-muted-foreground">{project.description}</p> : null}
        </div>
        {project.type === "retainer" ? <Badge variant="secondary">Retainer</Badge> : null}
      </div>

      {lines.length ? (
        <div className="grid gap-2.5">
          {lines.map((line) => {
            const service = line.serviceId ? serviceById.get(line.serviceId) : undefined;
            const pct = line.total ? Math.round((line.done / line.total) * 100) : 0;
            const color = service?.color ?? "#94a3b8";
            return (
              <div key={line.serviceId ?? "other"} className="grid gap-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-medium">{service?.name ?? "Alte sarcini"}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {line.done}/{line.total}
                  </span>
                  <span className="flex-1" />
                  {line.total && !line.next ? (
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2Icon className="size-3.5" /> gata
                    </span>
                  ) : null}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                {line.next ? (
                  <div className="truncate text-xs text-muted-foreground">
                    Acum: <span className="font-medium text-foreground">{line.next.title}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Fără servicii. Deschide proiectul și alege ce faci pentru client.</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {health.delivered ? (
          <span className="inline-flex items-center gap-1 text-success">
            <CheckCircle2Icon className="size-3.5" /> {project.archived ? "Arhivat" : `Livrat ${formatDate(project.delivered_at)}`}
          </span>
        ) : project.deadline ? (
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
            {formatDate(project.deadline)}
            {project.deadline === today ? " (azi)" : ""}
          </span>
        ) : null}
        {health.overdueTasks.length ? (
          <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-1.5 py-0.5 text-destructive">
            <AlertTriangleIcon className="size-3" />
            {health.overdueTasks.length === 1 ? "1 pas întârziat" : `${health.overdueTasks.length} pași întârziați`}
          </span>
        ) : null}
        <span className="flex-1" />
        {row.actors ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <UsersRoundIcon className="size-3.5" /> {row.actors}
          </span>
        ) : null}
        {isAdmin && money && !money.contractValue.isZero() ? (
          <span className="font-medium tabular-nums">{formatRON(money.contractValue)}</span>
        ) : null}
      </div>
    </Link>
  );
}

function ProjectsTable({ rows, serviceById, isAdmin }: { rows: Row[]; serviceById: Map<string, Service>; isAdmin: boolean }) {
  return (
    <div className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr className="[&>th]:h-9 [&>th]:px-3 [&>th]:text-left [&>th]:font-medium [&>th]:whitespace-nowrap">
              <th>Client</th>
              <th>Servicii</th>
              <th>Unde ești</th>
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
            {rows.map(({ project, health, money, serviceIds }) => (
              <tr
                key={project.id}
                className={cn(
                  "border-t [&>td]:px-3 [&>td]:py-2",
                  health.level === "red" && "bg-danger-soft",
                  health.level === "yellow" && "bg-warning-soft",
                  health.delivered && "text-muted-foreground",
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
                <td className="whitespace-nowrap">
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                    {serviceIds.map((id) => {
                      const s = serviceById.get(id);
                      return s ? (
                        <span key={id} className="inline-flex items-center gap-1">
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </td>
                <td className="max-w-64">
                  {health.delivered ? (
                    <span className="text-success">{project.archived ? "Arhivat" : "Livrat"}</span>
                  ) : health.next ? (
                    <span className="block truncate">
                      <span className="text-muted-foreground tabular-nums">
                        {health.done}/{health.total}
                      </span>{" "}
                      {health.next.title}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">fără pași</span>
                  )}
                  {health.overdueTasks.length ? (
                    <div className="text-[11px] text-destructive">{health.overdueTasks.length} pași întârziați</div>
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
            {rows.length === 0 ? (
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
