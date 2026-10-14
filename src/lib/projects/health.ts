import { addDays, format, parseISO } from "date-fns";
import type { Project, ProjectTask, Service } from "./types";

/** Pașii unui proiect, în ordinea serviciilor și apoi a pașilor. */
export function sortTasks(tasks: ProjectTask[], services: Pick<Service, "id" | "sort_order">[]): ProjectTask[] {
  const order = new Map(services.map((s) => [s.id, s.sort_order]));
  const rank = (t: ProjectTask) => (t.service_id ? (order.get(t.service_id) ?? 9_999) : 10_000);
  return [...tasks].sort((a, b) => rank(a) - rank(b) || a.sort_order - b.sort_order);
}

export type ServiceProgress = {
  serviceId: string | null;
  total: number;
  done: number;
  /** Primul pas nebifat: „unde ești” pe serviciul ăsta. */
  next: ProjectTask | null;
};

export type ProjectHealth = {
  delivered: boolean;
  total: number;
  done: number;
  /** Următorul pas de făcut (primul nebifat). */
  next: ProjectTask | null;
  /** Progres pe fiecare serviciu (un proiect poate avea mai multe). */
  byService: ServiceProgress[];
  /** Pași cu termenul trecut și nebifați. */
  overdueTasks: ProjectTask[];
  /** Pași cu termen azi, nebifați. */
  dueTodayTasks: ProjectTask[];
  deadlinePassed: boolean;
  deadlineSoon: boolean;
  level: "red" | "yellow" | null;
};

/**
 * Roșu: un pas are termenul depășit sau deadline-ul final a trecut.
 * Galben: deadline-ul final e în următoarele `warningDays` zile.
 * `tasks` trebuie să fie deja sortați (vezi `sortTasks`).
 */
export function projectHealth(
  project: Pick<Project, "deadline" | "archived" | "delivered_at">,
  tasks: ProjectTask[],
  today: string,
  warningDays: number,
): ProjectHealth {
  const open = tasks.filter((t) => !t.done_at);
  const byServiceMap = new Map<string | null, ServiceProgress>();
  for (const t of tasks) {
    const entry = byServiceMap.get(t.service_id) ?? { serviceId: t.service_id, total: 0, done: 0, next: null };
    entry.total += 1;
    if (t.done_at) entry.done += 1;
    else entry.next ??= t;
    byServiceMap.set(t.service_id, entry);
  }
  const base = {
    total: tasks.length,
    done: tasks.length - open.length,
    next: open[0] ?? null,
    byService: [...byServiceMap.values()],
  };

  const delivered = project.archived || Boolean(project.delivered_at);
  if (delivered) {
    return { ...base, delivered, overdueTasks: [], dueTodayTasks: [], deadlinePassed: false, deadlineSoon: false, level: null };
  }
  const overdueTasks = open.filter((t) => t.due_date && t.due_date < today);
  const dueTodayTasks = open.filter((t) => t.due_date === today);
  const warnUntil = format(addDays(parseISO(today), warningDays), "yyyy-MM-dd");
  const deadlinePassed = Boolean(project.deadline && project.deadline < today);
  const deadlineSoon = Boolean(project.deadline && !deadlinePassed && project.deadline <= warnUntil);
  const level = overdueTasks.length || deadlinePassed ? "red" : deadlineSoon ? "yellow" : null;
  return { ...base, delivered, overdueTasks, dueTodayTasks, deadlinePassed, deadlineSoon, level };
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseISO(toISO).getTime() - parseISO(fromISO).getTime()) / 86_400_000);
}

/** Termenul sugerat pentru un pas: data de start + N zile. */
export function suggestedDue(startDate: string | null, offsetDays: number | null): string | null {
  if (!startDate || offsetDays === null) return null;
  return format(addDays(parseISO(startDate), offsetDays), "yyyy-MM-dd");
}
