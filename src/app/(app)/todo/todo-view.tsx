"use client";

import { useState, useTransition } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { CheckCircle2Icon, ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/date-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatTime, parseTimeInput } from "@/lib/format";
import { daysBetween } from "@/lib/projects/health";
import type { PersonalTask } from "@/lib/todo/types";
import { cn } from "@/lib/utils";
import { createTodo, deleteTodo, updateTodo } from "./actions";

const plus = (today: string, days: number) => format(addDays(parseISO(today), days), "yyyy-MM-dd");

type Group = { key: string; title: string; tone?: "bad" | "today"; tasks: PersonalTask[] };

export function TodoView({ initialTasks, today }: { initialTasks: PersonalTask[]; today: string }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [prev, setPrev] = useState(initialTasks);
  if (prev !== initialTasks) {
    setPrev(initialTasks);
    setTasks(initialTasks);
  }
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(today);
  const [dueTime, setDueTime] = useState("");
  const [showDone, setShowDone] = useState(false);

  const tomorrow = plus(today, 1);
  const weekEnd = plus(today, 7);
  const open = tasks.filter((t) => !t.done_at);
  const doneTasks = tasks.filter((t) => t.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!));
  const groups: Group[] = [
    { key: "late", title: "Restante", tone: "bad" as const, tasks: open.filter((t) => t.due_date && t.due_date < today) },
    { key: "today", title: "Azi", tone: "today" as const, tasks: open.filter((t) => t.due_date === today) },
    { key: "tomorrow", title: "Mâine", tasks: open.filter((t) => t.due_date === tomorrow) },
    { key: "week", title: "Următoarele 7 zile", tasks: open.filter((t) => t.due_date && t.due_date > tomorrow && t.due_date <= weekEnd) },
    { key: "later", title: "Mai târziu", tasks: open.filter((t) => t.due_date && t.due_date > weekEnd) },
    { key: "nodate", title: "Fără dată", tasks: open.filter((t) => !t.due_date) },
  ].filter((g) => g.tasks.length);

  function add() {
    const text = title.trim();
    if (!text) return;
    const time = parseTimeInput(dueTime);
    if (time === undefined) return void toast.error("Ora nu e validă (ex. 10:00)");
    startTransition(async () => {
      const result = await createTodo({ title: text, due_date: dueDate, due_time: dueDate ? time : null });
      if (!result.ok) return void toast.error(result.error);
      setTasks((current) => [...current, result.data]);
      setTitle("");
      setDueTime("");
    });
  }

  function patch(task: PersonalTask, values: Parameters<typeof updateTodo>[1]) {
    const before = tasks;
    const optimistic: Partial<PersonalTask> = { ...values } as Partial<PersonalTask>;
    if (values.done !== undefined) optimistic.done_at = values.done ? (values.done_at ?? today) : null;
    delete (optimistic as Record<string, unknown>).done;
    setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, ...optimistic } : t)));
    startTransition(async () => {
      const result = await updateTodo(task.id, values);
      if (!result.ok) {
        toast.error(result.error);
        setTasks(before);
      } else setTasks((current) => current.map((t) => (t.id === task.id ? result.data : t)));
    });
  }

  function remove(task: PersonalTask) {
    const before = tasks;
    setTasks((current) => current.filter((t) => t.id !== task.id));
    startTransition(async () => {
      const result = await deleteTodo(task.id);
      if (!result.ok) {
        toast.error(result.error);
        setTasks(before);
      }
    });
  }

  const quick = [
    { label: "Azi", value: today },
    { label: "Mâine", value: tomorrow },
    { label: "Săpt. viitoare", value: plus(today, 7) },
    { label: "Fără dată", value: null },
  ];

  return (
    <div className="grid max-w-4xl grid-cols-1 gap-6 [&>*]:min-w-0">
      {/* Adăugare rapidă */}
      <form
        className="surface grid gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ce ai de făcut? ex. Setez campania TikTok pentru agenție"
            aria-label="Sarcină nouă"
            className="h-10 flex-1 text-[15px]"
            autoFocus
          />
          <Button type="submit" className="h-10" disabled={pending || !title.trim()}>
            <PlusIcon /> Adaugă
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setDueDate(q.value)}
              className={cn(
                "h-8 rounded-full border bg-card px-3 text-sm text-muted-foreground hover:text-foreground",
                dueDate === q.value && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
              )}
            >
              {q.label}
            </button>
          ))}
          <DateField value={dueDate} onChange={setDueDate} className="h-8 w-40" placeholder="altă dată" aria-label="Data sarcinii" />
          {dueDate ? (
            <Input
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              placeholder="ora (opțional)"
              aria-label="Ora sarcinii"
              className="h-8 w-32"
            />
          ) : null}
        </div>
      </form>

      {groups.map((g) => (
        <section key={g.key} className="grid gap-2">
          <h2 className={cn("flex items-baseline gap-2 text-sm font-semibold", g.tone === "bad" && "text-destructive")}>
            {g.title}
            <span className="text-xs font-normal text-muted-foreground tabular-nums">{g.tasks.length}</span>
          </h2>
          <ul className="surface divide-y overflow-hidden">
            {g.tasks.map((t) => (
              <TodoRow key={t.id} task={t} today={today} onPatch={patch} onRemove={remove} />
            ))}
          </ul>
        </section>
      ))}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <CheckCircle2Icon className="size-8 text-brand-strong" />
          <p className="text-sm text-muted-foreground">Nimic de făcut. Adaugă mai sus ce ai de programat.</p>
        </div>
      ) : null}

      {doneTasks.length ? (
        <section className="grid gap-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronDownIcon className={cn("size-4 transition-transform", !showDone && "-rotate-90")} />
            Făcute (ultimele 30 de zile)
            <span className="text-xs font-normal tabular-nums">{doneTasks.length}</span>
          </button>
          {showDone ? (
            <ul className="surface divide-y overflow-hidden">
              {doneTasks.map((t) => (
                <TodoRow key={t.id} task={t} today={today} onPatch={patch} onRemove={remove} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function TodoRow({
  task,
  today,
  onPatch,
  onRemove,
}: {
  task: PersonalTask;
  today: string;
  onPatch: (task: PersonalTask, values: Parameters<typeof updateTodo>[1]) => void;
  onRemove: (task: PersonalTask) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const done = Boolean(task.done_at);
  const late = !done && task.due_date && task.due_date < today;

  return (
    <li className="group flex items-start gap-3 px-4 py-2.5">
      <Checkbox
        checked={done}
        onCheckedChange={(v) => onPatch(task, { done: v === true })}
        aria-label={`${done ? "Debifează" : "Bifează"} ${task.title}`}
        className="mt-1 size-5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              autoFocus
              defaultValue={task.title}
              className="h-8"
              aria-label="Titlu sarcină"
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
              className={cn("max-w-full text-left text-sm leading-6", done && "text-muted-foreground line-through")}
              title="Click ca să editezi"
            >
              {task.title}
            </button>
          )}
          {notesOpen ? (
            <textarea
              autoFocus
              defaultValue={task.notes ?? ""}
              rows={2}
              placeholder="Detalii…"
              aria-label="Detalii sarcină"
              className="mt-1 w-full rounded-md border bg-card px-2 py-1 text-sm outline-none focus:border-ring"
              onBlur={(e) => {
                setNotesOpen(false);
                if ((e.target.value.trim() || null) !== task.notes) onPatch(task, { notes: e.target.value });
              }}
            />
          ) : task.notes ? (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="block text-left text-xs whitespace-pre-line text-muted-foreground"
            >
              {task.notes}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="text-xs text-muted-foreground/70 opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
            >
              + detalii
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
          {done ? (
            <>
              <span className="text-xs text-muted-foreground">făcut pe</span>
              <DateField
                value={task.done_at}
                onChange={(v) => v && v <= today && onPatch(task, { done_at: v })}
                className="h-8 w-40 text-muted-foreground"
                aria-label={`Făcut pe ${task.title}`}
              />
            </>
          ) : (
            <>
              {late ? (
                <span className="text-xs font-medium whitespace-nowrap text-destructive">
                  {daysBetween(task.due_date!, today) === 1 ? "de ieri" : `de ${daysBetween(task.due_date!, today)} zile`}
                </span>
              ) : task.due_date && task.due_date !== today ? (
                <span className="text-xs whitespace-nowrap text-muted-foreground capitalize">
                  {format(parseISO(task.due_date), "EEE", { locale: ro })}
                </span>
              ) : null}
              <input
                key={`${task.id}-time-${task.due_time}`}
                defaultValue={task.due_time ? formatTime(task.due_time) : ""}
                placeholder="ora"
                aria-label={`Ora ${task.title}`}
                className="h-8 w-16 rounded-md border border-transparent bg-transparent px-1.5 text-center text-sm tabular-nums outline-none hover:border-input focus:border-ring focus:bg-card"
                onBlur={(e) => {
                  const time = parseTimeInput(e.target.value);
                  if (time === undefined) return void toast.error("Ora nu e validă (ex. 10:00)");
                  if (time !== (task.due_time?.slice(0, 5) ?? null)) onPatch(task, { due_time: time });
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
              <DateField
                value={task.due_date}
                onChange={(v) => onPatch(task, { due_date: v })}
                className="h-8 w-40"
                placeholder="fără dată"
                aria-label={`Data ${task.title}`}
              />
            </>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Șterge ${task.title}`}
        onClick={() => onRemove(task)}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}
