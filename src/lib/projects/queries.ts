import "server-only";
import { isMissingRelation } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import type { AppSettings, CostType, ExpenseCategory, ProjectStage } from "@/lib/types";
import {
  ACTOR_COLUMNS,
  type Actor,
  PROJECT_COLUMNS,
  type Project,
  type ProjectActor,
  type ProjectFinance,
  type Shoot,
  type StageDeadline,
  TX_COLUMNS,
  type Transaction,
} from "./types";

export async function fetchStages(): Promise<ProjectStage[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("project_stages").select("*").order("sort_order").returns<ProjectStage[]>();
  return data ?? [];
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").single<AppSettings>();
  return (
    data ?? {
      follow_up_days: 7,
      follow_up_default_time: "10:00",
      deadline_warning_days: 7,
      daily_email_time: "08:00",
      timezone: "Europe/Bucharest",
    }
  );
}

export type ProjectListData = {
  projects: Project[];
  deadlines: StageDeadline[];
  finance: ProjectFinance[];
  transactions: Transaction[];
  actorCounts: Record<string, number>;
};

/** `null` dacă tabelele din Etapa 3 nu există încă. */
export async function fetchProjectList(isAdmin: boolean): Promise<ProjectListData | null> {
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("board_position")
    .order("created_at")
    .returns<Project[]>();
  if (error) {
    if (isMissingRelation(error)) return null;
    throw new Error(error.message);
  }

  const [{ data: deadlines }, { data: projectActors }, finance, transactions] = await Promise.all([
    supabase.from("project_stage_deadlines").select("*").returns<StageDeadline[]>(),
    supabase.from("project_actors").select("project_id").returns<{ project_id: string }[]>(),
    isAdmin ? supabase.from("project_finance").select("*").returns<ProjectFinance[]>() : Promise.resolve({ data: [] as ProjectFinance[] }),
    isAdmin
      ? supabase.from("transactions").select(TX_COLUMNS).not("project_id", "is", null).returns<Transaction[]>()
      : Promise.resolve({ data: [] as Transaction[] }),
  ]);

  const actorCounts: Record<string, number> = {};
  for (const pa of projectActors ?? []) actorCounts[pa.project_id] = (actorCounts[pa.project_id] ?? 0) + 1;

  return {
    projects,
    deadlines: deadlines ?? [],
    finance: finance.data ?? [],
    transactions: transactions.data ?? [],
    actorCounts,
  };
}

export type ProjectDetailData = {
  project: Project;
  finance: ProjectFinance | null;
  deadlines: StageDeadline[];
  transactions: Transaction[];
  projectActors: ProjectActor[];
  actors: Actor[];
  shoots: Shoot[];
  costTypes: CostType[];
  categories: ExpenseCategory[];
};

export async function fetchProjectDetail(id: string, isAdmin: boolean): Promise<ProjectDetailData | null> {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select(PROJECT_COLUMNS).eq("id", id).maybeSingle<Project>();
  if (!project) return null;

  const [deadlines, projectActors, actors, shoots, finance, transactions, costTypes, categories] = await Promise.all([
    supabase.from("project_stage_deadlines").select("*").eq("project_id", id).returns<StageDeadline[]>(),
    supabase.from("project_actors").select("*").eq("project_id", id).order("created_at").returns<ProjectActor[]>(),
    supabase.from("actors").select(ACTOR_COLUMNS).order("name").returns<Actor[]>(),
    fetchShoots({ projectId: id }),
    isAdmin
      ? supabase.from("project_finance").select("*").eq("project_id", id).maybeSingle<ProjectFinance>()
      : Promise.resolve({ data: null }),
    isAdmin
      ? supabase.from("transactions").select(TX_COLUMNS).eq("project_id", id).order("due_date").order("created_at").returns<Transaction[]>()
      : Promise.resolve({ data: [] as Transaction[] }),
    isAdmin
      ? supabase.from("cost_types").select("*").order("sort_order").returns<CostType[]>()
      : Promise.resolve({ data: [] as CostType[] }),
    isAdmin
      ? supabase.from("expense_categories").select("*").order("sort_order").returns<ExpenseCategory[]>()
      : Promise.resolve({ data: [] as ExpenseCategory[] }),
  ]);

  return {
    project,
    finance: finance.data,
    deadlines: deadlines.data ?? [],
    transactions: transactions.data ?? [],
    projectActors: projectActors.data ?? [],
    actors: actors.data ?? [],
    shoots,
    costTypes: costTypes.data ?? [],
    categories: categories.data ?? [],
  };
}

type ShootRow = Omit<Shoot, "actor_ids"> & { shoot_actors: { actor_id: string }[] };

export async function fetchShoots(filter: { projectId?: string; from?: string; to?: string; actorId?: string }): Promise<Shoot[]> {
  const supabase = await createClient();
  let query = supabase
    .from("shoots")
    .select("id, project_id, shoot_date, start_time, end_time, location, notes, is_seed, shoot_actors(actor_id)")
    .order("shoot_date")
    .order("start_time", { nullsFirst: true });
  if (filter.projectId) query = query.eq("project_id", filter.projectId);
  if (filter.from) query = query.gte("shoot_date", filter.from);
  if (filter.to) query = query.lte("shoot_date", filter.to);
  const { data } = await query.returns<ShootRow[]>();
  const shoots = (data ?? []).map(({ shoot_actors, ...s }) => ({ ...s, actor_ids: shoot_actors.map((a) => a.actor_id) }));
  return filter.actorId ? shoots.filter((s) => s.actor_ids.includes(filter.actorId!)) : shoots;
}

export async function fetchActors(): Promise<Actor[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("actors").select(ACTOR_COLUMNS).order("name").returns<Actor[]>();
  return data ?? [];
}

/** Proiecte scurte pentru selecturi (filmări, calendar). */
export async function fetchProjectOptions(): Promise<{ id: string; client_name: string; archived: boolean }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, client_name, archived")
    .order("archived")
    .order("client_name")
    .returns<{ id: string; client_name: string; archived: boolean }[]>();
  return data ?? [];
}
