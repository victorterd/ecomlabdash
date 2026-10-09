import { addDays, format, parseISO } from "date-fns";
import type { ProjectStage } from "@/lib/types";
import type { Project, StageDeadline } from "./types";

export type ProjectHealth = {
  delivered: boolean;
  /** Etape cu termenul trecut și nerealizate. */
  overdueStages: StageDeadline[];
  /** Etape cu termen azi, nerealizate. */
  dueTodayStages: StageDeadline[];
  deadlinePassed: boolean;
  deadlineSoon: boolean;
  level: "red" | "yellow" | null;
};

/**
 * Roșu: o etapă are termenul depășit sau deadline-ul final a trecut.
 * Galben: deadline-ul final e în următoarele `warningDays` zile.
 */
export function projectHealth(
  project: Pick<Project, "deadline" | "current_stage_id" | "archived">,
  deadlines: StageDeadline[],
  stageById: Map<string, ProjectStage>,
  today: string,
  warningDays: number,
): ProjectHealth {
  const delivered = project.archived || Boolean(project.current_stage_id && stageById.get(project.current_stage_id)?.is_final);
  if (delivered) {
    return { delivered, overdueStages: [], dueTodayStages: [], deadlinePassed: false, deadlineSoon: false, level: null };
  }
  const open = deadlines.filter((d) => !d.completed_date && d.planned_date);
  const overdueStages = open.filter((d) => d.planned_date! < today);
  const dueTodayStages = open.filter((d) => d.planned_date === today);
  const warnUntil = format(addDays(parseISO(today), warningDays), "yyyy-MM-dd");
  const deadlinePassed = Boolean(project.deadline && project.deadline < today);
  const deadlineSoon = Boolean(project.deadline && !deadlinePassed && project.deadline <= warnUntil);
  const level = overdueStages.length || deadlinePassed ? "red" : deadlineSoon ? "yellow" : null;
  return { delivered, overdueStages, dueTodayStages, deadlinePassed, deadlineSoon, level };
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseISO(toISO).getTime() - parseISO(fromISO).getTime()) / 86_400_000);
}
