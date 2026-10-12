"use client";

import { useState, useTransition } from "react";
import { ArrowDownIcon, ArrowUpIcon, CheckCircle2Icon, EllipsisIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/confirm-dialog";
import { DateField } from "@/components/date-field";
import { ServicePicker } from "@/components/service-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Result } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import { daysBetween, sortTasks } from "@/lib/projects/health";
import type { ProjectTask, Service } from "@/lib/projects/types";
import { cn } from "@/lib/utils";
import { addTask, deleteTask, reorderTasks, setProjectServices, type TasksState, updateTask } from "../actions";

export function TasksTab({
  projectId,
  services,
  state,
  today,
  onState,
}: {
  projectId: string;
  services: Service[];
  state: TasksState;
  today: string;
  onState: (state: TasksState) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<Service | null>(null);
  const [showOther, setShowOther] = useState(false);
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const tasks = sortTasks(state.tasks, services);

  function run(action: () => Promise<Result<TasksState>>, optimistic?: TasksState) {
    const before = state;
    if (optimistic) onState(optimistic);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onState(result.data);
      else {
        toast.error(result.error);
        onState(before);
      }
    });
  }

  function toggle(task: ProjectTask, done: boolean) {
    const tasksNext = state.tasks.map((t) => (t.id === task.id ? { ...t, done_at: done ? today : null } : t));
    run(() => updateTask(task.id, { done }), { ...state, tasks: tasksNext });
  }

  function patch(task: ProjectTask, values: { title?: string; due_date?: string | null }) {
    const tasksNext = state.tasks.map((t) => (t.id === task.id ? { ...t, ...values } : t));
    run(() => updateTask(task.id, values), { ...state, tasks: tasksNext });
  }

  function move(task: ProjectTask, delta: number) {
    const group = tasks.filter((t) => t.service_id === task.service_id);
    const index = group.findIndex((t) => t.id === task.id);
    const target = index + delta;
    if (target < 0 || target >= group.length) return;
    const reordered = [...group];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    // Ordinea finală a tuturor pașilor: grupul mutat își păstrează locul între celelalte servicii.
    const others = tasks.filter((t) => t.service_id !== task.service_id);
    const ids = [...others, ...reordered].map((t) => t.id);
    const sortOrder = new Map(reordered.map((t, i) => [t.id, (i + 1) * 10]));
    run(() => reorderTasks(projectId, ids), {
      ...state,
      tasks: state.tasks.map((t) => (sortOrder.has(t.id) ? { ...t, sort_order: sortOrder.get(t.id)! } : t)),
    });
  }

  function toggleService(serviceId: string, selected: boolean) {
    if (!selected) {
      setRemoving(serviceById.get(serviceId) ?? null);
      return;
    }
    run(() => setProjectServices(projectId, [...state.serviceIds, serviceId]));
  }

  // Grupuri: serviciile alese (în ordinea din Setări), apoi pașii fără serviciu.
  const groups = [
    ...services
      .filter((s) => state.serviceIds.includes(s.id) || tasks.some((t) => t.service_id === s.id))
      .map((s) => ({ key: s.id, serviceId: s.id as string | null, name: s.name, color: s.color })),
    ...(tasks.some((t) => !t.service_id || !serviceById.has(t.service_id)) || showOther
      ? [{ key: "other", serviceId: null, name: "Alte sarcini", color: "#94a3b8" }]
      : []),
  ];
  const removingTasks = removing ? state.tasks.filter((t) => t.service_id === removing.id) : [];

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="surface grid gap-3 p-4">
        <div className="text-sm font-semibold">Servicii pe proiect</div>
        <ServicePicker services={services} value={state.serviceIds} onToggle={toggleService} disabled={pending} />
      </div>

      {groups.map((g) => (
        <TaskGroup
          key={g.key}
          name={g.name}
          color={g.color}
          tasks={tasks.filter((t) => (g.serviceId ? t.service_id === g.serviceId : !t.service_id || !serviceById.has(t.service_id)))}
          today={today}
          onToggle={toggle}
          onPatch={patch}
          onMove={move}
          onDelete={(t) => run(() => deleteTask(t.id), { ...state, tasks: state.tasks.filter((x) => x.id !== t.id) })}
          onAdd={(title) => run(() => addTask(projectId, g.serviceId, title))}
        />
      ))}

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
          Alege mai sus ce servicii are proiectul. Fiecare vine cu pașii lui, pe care îi bifezi pe măsură ce îi faci.
        </div>
      ) : null}

      {!groups.some((g) => g.key === "other") ? (
        <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={() => setShowOther(true)}>
          <PlusIcon /> Sarcină separată (în afara serviciilor)
        </Button>
      ) : null}

      <ConfirmDeleteDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Scoți „${removing?.name}” de pe proiect?`}
        description={
          removingTasks.length
            ? `Se șterg și cei ${removingTasks.length} pași ai lui (${removingTasks.filter((t) => t.done_at).length} bifați).`
            : "Serviciul nu are pași pe proiect."
        }
        confirmLabel="Scoate serviciul"
        pending={pending}
        onConfirm={() => {
          const id = removing!.id;
          setRemoving(null);
          run(() =>
            setProjectServices(
              projectId,
              state.serviceIds.filter((x) => x !== id),
            ),
          );
        }}
      />
    </div>
  );
}

function TaskGroup({
  name,
  color,
  tasks,
  today,
  onToggle,
  onPatch,
  onMove,
  onDelete,
  onAdd,
}: {
  name: string;
  color: string;
  tasks: ProjectTask[];
  today: string;
  onToggle: (task: ProjectTask, done: boolean) => void;
  onPatch: (task: ProjectTask, values: { title?: string; due_date?: string | null }) => void;
  onMove: (task: ProjectTask, delta: number) => void;
  onDelete: (task: ProjectTask) => void;
  onAdd: (title: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const done = tasks.filter((t) => t.done_at).length;
  const next = tasks.find((t) => !t.done_at);
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <section className="surface overflow-hidden">
      <header className="grid gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="font-semibold">{name}</h3>
          <span className="text-sm text-muted-foreground tabular-nums">
            {done} din {tasks.length}
          </span>
          <span className="flex-1" />
          {tasks.length && !next ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
              <CheckCircle2Icon className="size-4" /> Gata
            </span>
          ) : next ? (
            <span className="truncate text-sm text-muted-foreground">
              Acum: <b className="font-medium text-foreground">{next.title}</b>
            </span>
          ) : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </header>

      <ul className="divide-y">
        {tasks.map((task, index) => (
          <TaskRow
            key={task.id}
            task={task}
            current={task.id === next?.id}
            first={index === 0}
            last={index === tasks.length - 1}
            today={today}
            onToggle={onToggle}
            onPatch={onPatch}
            onMove={onMove}
            onDelete={onDelete}
          />
        ))}
      </ul>

      <form
        className="flex items-center gap-2 border-t bg-muted/30 px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onAdd(draft.trim());
          setDraft("");
        }}
      >
        <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Adaugă un pas…"
          aria-label={`Pas nou la ${name}`}
          className="h-8 border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-card"
        />
        {draft.trim() ? (
          <Button type="submit" size="sm">
            Adaugă
          </Button>
        ) : null}
      </form>
    </section>
  );
}

function TaskRow({
  task,
  current,
  first,
  last,
  today,
  onToggle,
  onPatch,
  onMove,
  onDelete,
}: {
  task: ProjectTask;
  current: boolean;
  first: boolean;
  last: boolean;
  today: string;
  onToggle: (task: ProjectTask, done: boolean) => void;
  onPatch: (task: ProjectTask, values: { title?: string; due_date?: string | null }) => void;
  onMove: (task: ProjectTask, delta: number) => void;
  onDelete: (task: ProjectTask) => void;
}) {
  const [editing, setEditing] = useState(false);
  const done = Boolean(task.done_at);
  const overdue = !done && task.due_date && task.due_date < today;
  const dueToday = !done && task.due_date === today;

  return (
    <li className={cn("flex items-start gap-3 px-4 py-2.5 sm:items-center", current && "bg-accent/40")}>
      <Checkbox
        checked={done}
        onCheckedChange={(v) => onToggle(task, v === true)}
        aria-label={`${done ? "Debifează" : "Bifează"} ${task.title}`}
        className="mt-1.5 size-5 sm:mt-0"
      />
      {/* Pe telefon: numele pe primul rând, starea și termenul dedesubt. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              autoFocus
              defaultValue={task.title}
              className="h-8"
              aria-label="Nume pas"
              onBlur={(e) => {
                setEditing(false);
                const value = e.target.value.trim();
                if (value && value !== task.title) onPatch(task, { title: value });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={cn(
                "max-w-full truncate text-left text-sm",
                done && "text-muted-foreground line-through",
                current && "font-semibold",
              )}
              title="Click ca să redenumești"
            >
              {task.title}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:shrink-0 sm:flex-nowrap">
          {current ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-brand-foreground">Acum</span> : null}
          <span
            className={cn(
              "text-xs whitespace-nowrap text-muted-foreground sm:w-28 sm:text-right",
              overdue && "font-medium text-destructive",
              dueToday && "font-medium text-warning",
            )}
          >
            {done
              ? `bifat ${formatDate(task.done_at)}`
              : overdue
                ? `întârziat ${daysBetween(task.due_date!, today)} zile`
                : dueToday
                  ? "termen azi"
                  : task.due_date
                    ? `în ${daysBetween(today, task.due_date)} zile`
                    : ""}
          </span>
          {done ? (
            <span className="hidden w-40 sm:block" />
          ) : (
            <DateField
              value={task.due_date}
              onChange={(v) => onPatch(task, { due_date: v })}
              className="h-8 w-40 shrink-0"
              placeholder="termen"
              aria-label={`Termen ${task.title}`}
            />
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Acțiuni ${task.title}`}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={first} onSelect={() => onMove(task, -1)}>
            <ArrowUpIcon /> Mută mai sus
          </DropdownMenuItem>
          <DropdownMenuItem disabled={last} onSelect={() => onMove(task, 1)}>
            <ArrowDownIcon /> Mută mai jos
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(task)}>
            <Trash2Icon /> Șterge pasul
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
