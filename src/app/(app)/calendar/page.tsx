import { addDays, addMonths, endOfMonth, endOfWeek, format, isValid, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { redirect } from "next/navigation";
import { MigrationNeeded } from "@/components/layout/migration-needed";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { fetchActors, fetchProjectOptions, fetchServices, fetchShoots } from "@/lib/projects/queries";
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

  const [shoots, services, actors, projectOptions, tasks, followUps, projectActors] = await Promise.all([
    fetchShoots(range),
    fetchServices(),
    fetchActors(),
    fetchProjectOptions(),
    // Pașii nebifați cu termen în intervalul afișat, pe proiectele active.
    supabase
      .from("project_tasks")
      .select("id, title, due_date, service_id, project:projects!inner(id, client_name, archived)")
      .is("done_at", null)
      .gte("due_date", range.from)
      .lte("due_date", range.to)
      .eq("project.archived", false)
      .returns<{ id: string; title: string; due_date: string; service_id: string | null; project: { id: string; client_name: string } }[]>(),
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
  const serviceById = new Map((services ?? []).map((s) => [s.id, s]));
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
    ...(tasks.data ?? []).map(
      (t): CalendarEvent => ({
        id: `stage-${t.id}`,
        kind: "stage",
        date: t.due_date,
        title: t.project.client_name,
        detail: t.title,
        color: t.service_id ? serviceById.get(t.service_id)?.color : undefined,
        href: `/proiecte/${t.project.id}`,
      }),
    ),
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
