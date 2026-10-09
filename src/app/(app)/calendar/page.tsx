import { addDays, addMonths, endOfMonth, endOfWeek, format, isValid, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { redirect } from "next/navigation";
import { MigrationNeeded } from "@/components/layout/migration-needed";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { fetchActors, fetchProjectOptions, fetchShoots, fetchStages } from "@/lib/projects/queries";
import { createClient } from "@/lib/supabase/server";
import { CalendarView, type CalendarEvent } from "./calendar-view";

export const metadata = { title: "Calendar" };

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const profile = await requireProfile();
  if (profile.role === "setter") redirect("/");
  const params = await searchParams;
  const view = params.v === "saptamana" ? "saptamana" : "luna";
  const today = todayISO();
  const anchorParam = typeof params.d === "string" ? parseISO(params.d) : null;
  const anchor = anchorParam && isValid(anchorParam) ? anchorParam : parseISO(today);

  const from = view === "luna" ? startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }) : startOfWeek(anchor, { weekStartsOn: 1 });
  const to = view === "luna" ? endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }) : endOfWeek(anchor, { weekStartsOn: 1 });
  const range = { from: iso(from), to: iso(to) };

  const supabase = await createClient();
  const projectsQuery = await supabase
    .from("projects")
    .select("id, client_name, deadline")
    .eq("archived", false)
    .gte("deadline", range.from)
    .lte("deadline", range.to)
    .returns<{ id: string; client_name: string; deadline: string }[]>();
  if (projectsQuery.error?.code === "PGRST205" || projectsQuery.error?.code === "42P01") {
    return <MigrationNeeded title="Calendar" file="20261011000003_projects.sql" />;
  }

  const [shoots, stages, actors, projectOptions, stageDeadlines, followUps, projectActors] = await Promise.all([
    fetchShoots(range),
    fetchStages(),
    fetchActors(),
    fetchProjectOptions(),
    // Doar etapa la care se lucrează (prima nefinalizată) a fiecărui proiect activ.
    supabase
      .from("project_stage_deadlines")
      .select("id, planned_date, stage_id, project:projects!inner(id, client_name, archived)")
      .is("completed_date", null)
      .not("planned_date", "is", null)
      .eq("project.archived", false)
      .returns<{ id: string; planned_date: string; stage_id: string; project: { id: string; client_name: string } }[]>(),
    profile.role === "productie"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("leads")
          .select("id, company_name, follow_up_date, follow_up_time, status:lead_statuses!inner(is_closed)")
          .gte("follow_up_date", range.from)
          .lte("follow_up_date", range.to)
          .eq("status.is_closed", false)
          .returns<{ id: string; company_name: string; follow_up_date: string; follow_up_time: string | null }[]>(),
    supabase.from("project_actors").select("project_id, actor_id").returns<{ project_id: string; actor_id: string }[]>(),
  ]);

  const projectName = new Map(projectOptions.map((p) => [p.id, p.client_name]));
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const actorName = new Map(actors.map((a) => [a.id, a.name]));

  const events: CalendarEvent[] = [
    ...shoots.map((s): CalendarEvent => ({
      id: `shoot-${s.id}`,
      kind: "shoot",
      date: s.shoot_date,
      time: s.start_time,
      title: s.project_id ? (projectName.get(s.project_id) ?? "Filmare") : "Filmare",
      detail: [
        s.location,
        s.actor_ids
          .map((id) => actorName.get(id))
          .filter(Boolean)
          .join(", "),
      ]
        .filter(Boolean)
        .join(" · "),
      shoot: s,
    })),
    ...(projectsQuery.data ?? []).map((p): CalendarEvent => ({
      id: `deadline-${p.id}`,
      kind: "deadline",
      date: p.deadline,
      title: p.client_name,
      detail: "Deadline livrare",
      href: `/proiecte/${p.id}`,
    })),
    ...nextStagePerProject(stageDeadlines.data ?? [], stages)
      .filter((d) => d.planned_date >= range.from && d.planned_date <= range.to)
      .map((d): CalendarEvent => ({
        id: `stage-${d.id}`,
        kind: "stage",
        date: d.planned_date,
        title: d.project.client_name,
        detail: stageById.get(d.stage_id)?.name ?? "Etapă",
        color: stageById.get(d.stage_id)?.color,
        href: `/proiecte/${d.project.id}?tab=etape`,
      })),
    ...(followUps.data ?? []).map((l): CalendarEvent => ({
      id: `lead-${l.id}`,
      kind: "followup",
      date: l.follow_up_date,
      time: l.follow_up_time,
      title: l.company_name,
      detail: "Follow-up",
      href: `/leaduri?lead=${l.id}`,
    })),
  ];

  const projectActorIds: Record<string, string[]> = {};
  for (const pa of projectActors.data ?? []) projectActorIds[pa.project_id] = [...(projectActorIds[pa.project_id] ?? []), pa.actor_id];

  const step =
    view === "luna"
      ? { prev: iso(addMonths(anchor, -1)), next: iso(addMonths(anchor, 1)) }
      : { prev: iso(addDays(anchor, -7)), next: iso(addDays(anchor, 7)) };

  return (
    <>
      <PageHeader title="Calendar" />
      <CalendarView
        view={view}
        anchor={iso(anchor)}
        from={range.from}
        to={range.to}
        prev={step.prev}
        next={step.next}
        today={today}
        events={events}
        showFollowUps={profile.role !== "productie"}
        projects={projectOptions}
        actors={actors}
        projectActorIds={projectActorIds}
      />
    </>
  );
}

function nextStagePerProject<T extends { stage_id: string; project: { id: string } }>(
  deadlines: T[],
  stages: { id: string; sort_order: number; is_final: boolean }[],
): T[] {
  const order = new Map(stages.map((s) => [s.id, s.sort_order]));
  const best = new Map<string, T>();
  for (const d of deadlines) {
    const current = best.get(d.project.id);
    if (!current || (order.get(d.stage_id) ?? 0) < (order.get(current.stage_id) ?? 0)) best.set(d.project.id, d);
  }
  return [...best.values()];
}
