"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, invalid, ok, type Result } from "@/lib/action-result";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { suggestedDue } from "@/lib/projects/health";
import {
  PROJECT_COLUMNS,
  type Project,
  type ProjectFinance,
  type ProjectTask,
  type ServiceStep,
  TASK_COLUMNS,
  TX_COLUMNS,
  type Transaction,
} from "@/lib/projects/types";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
import { moneyInput, percentInput } from "@/lib/validation";

async function requireProduction() {
  const profile = await requireProfile();
  if (profile.role === "setter") throw new Error("Nu ai acces la proiecte");
  return profile;
}

const text = z
  .string()
  .trim()
  .max(5000)
  .nullable()
  .transform((v) => v || null);
const date = z.iso.date("Dată invalidă").nullable();

const projectSchema = z.object({
  lead_id: z.uuid().nullable(),
  client_name: z.string().trim().min(1, "Numele clientului e obligatoriu").max(300),
  contact_name: text,
  contact_email: text,
  contact_phone: text,
  website: text,
  description: text,
  type: z.enum(["proiect", "retainer"]),
  start_date: date,
  deadline: date,
  notes: z
    .string()
    .max(50000)
    .nullable()
    .transform((v) => (v?.trim() ? v : null)),
  archived: z.boolean(),
});

const financeSchema = z.object({
  contract_value: moneyInput,
  commission_enabled: z.boolean(),
  setter_commission_pct: percentInput,
  setter_name: text,
  retainer_monthly_amount: moneyInput.nullable(),
  retainer_start_month: date,
  retainer_end_month: date,
});

function revalidateProjects(id?: string) {
  revalidatePath("/proiecte");
  revalidatePath("/calendar");
  revalidatePath("/actori", "layout");
  if (id) revalidatePath(`/proiecte/${id}`);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------
// Proiect
// ---------------------------------------------------------------------

export async function createProject(
  values: Record<string, unknown>,
  financeValues: Record<string, unknown> | null,
  serviceIds: string[] = [],
): Promise<Result<string>> {
  const profile = await requireProduction();
  const parsed = projectSchema.omit({ archived: true }).safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues);
  const services = z.array(z.uuid()).safeParse(serviceIds);
  if (!services.success) return invalid(services.error.issues);

  const isAdmin = profile.role === "admin";
  const finance = isAdmin && financeValues ? financeSchema.partial().safeParse(financeValues) : null;
  if (finance && !finance.success) return invalid(finance.error.issues);

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("projects")
    .select("board_position")
    .order("board_position", { ascending: false })
    .limit(1)
    .maybeSingle<{ board_position: number }>();

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, board_position: (last?.board_position ?? 0) + 1000 })
    .select("id")
    .single<{ id: string }>();
  if (error) return fail(error);

  if (finance?.success) {
    const { error: finError } = await supabase.from("project_finance").insert({ project_id: data.id, ...finance.data });
    if (finError) return fail(finError);
  }

  const servicesError = await addServices(supabase, data.id, services.data, parsed.data.start_date);
  if (servicesError) return fail(servicesError);

  revalidateProjects(data.id);
  revalidatePath("/leaduri");
  return ok(data.id);
}

export async function updateProject(id: string, patch: Record<string, unknown>): Promise<Result<Project>> {
  await requireProduction();
  const parsed = projectSchema.partial().safeParse(patch);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").update(parsed.data).eq("id", id).select(PROJECT_COLUMNS).single<Project>();
  if (error) return fail(error);
  revalidateProjects(id);
  return ok(data);
}

export async function deleteProject(id: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id)
    .eq("status", "realized");
  if (count) {
    return {
      ok: false,
      error: "Proiectul are încasări sau plăți realizate. Arhivează-l în loc să-l ștergi, ca să nu pierzi istoricul din cashflow.",
    };
  }
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return fail(error);
  revalidateProjects();
  return ok(null);
}

export async function updateFinance(
  projectId: string,
  patch: Record<string, unknown>,
): Promise<Result<{ finance: ProjectFinance; transactions: Transaction[] }>> {
  await requireAdmin();
  const parsed = financeSchema.partial().safeParse(patch);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_finance")
    .upsert({ project_id: projectId, ...parsed.data }, { onConflict: "project_id" })
    .select("*")
    .single<ProjectFinance>();
  if (error) return fail(error);
  revalidateProjects(projectId);
  return ok({ finance: data, transactions: await projectTransactions(projectId) });
}

// ---------------------------------------------------------------------
// Servicii și pași (checklist)
// ---------------------------------------------------------------------

export type TasksState = { tasks: ProjectTask[]; serviceIds: string[]; deliveredAt: string | null };

async function tasksState(supabase: Supabase, projectId: string): Promise<TasksState> {
  const [{ data: tasks }, { data: services }, { data: project }] = await Promise.all([
    supabase.from("project_tasks").select(TASK_COLUMNS).eq("project_id", projectId).order("sort_order").returns<ProjectTask[]>(),
    supabase.from("project_services").select("service_id").eq("project_id", projectId).returns<{ service_id: string }[]>(),
    supabase.from("projects").select("delivered_at").eq("id", projectId).maybeSingle<{ delivered_at: string | null }>(),
  ]);
  return { tasks: tasks ?? [], serviceIds: (services ?? []).map((s) => s.service_id), deliveredAt: project?.delivered_at ?? null };
}

/** Adaugă servicii pe proiect, cu pașii lor ca checklist (termen = start + zilele din Setări). */
async function addServices(supabase: Supabase, projectId: string, serviceIds: string[], startDate: string | null) {
  if (!serviceIds.length) return null;
  const { error } = await supabase
    .from("project_services")
    .upsert(
      serviceIds.map((service_id) => ({ project_id: projectId, service_id })),
      { onConflict: "project_id,service_id", ignoreDuplicates: true },
    );
  if (error) return error;
  const { data: steps } = await supabase
    .from("service_steps")
    .select("id, service_id, name, sort_order, default_offset_days")
    .in("service_id", serviceIds)
    .returns<ServiceStep[]>();
  if (!steps?.length) return null;
  const { error: tasksError } = await supabase.from("project_tasks").insert(
    steps.map((step) => ({
      project_id: projectId,
      service_id: step.service_id,
      title: step.name,
      sort_order: step.sort_order,
      due_date: suggestedDue(startDate, step.default_offset_days),
    })),
  );
  return tasksError;
}

/** Serviciile proiectului: cele noi primesc pașii lor, cele scoase își pierd pașii. */
export async function setProjectServices(projectId: string, serviceIds: string[]): Promise<Result<TasksState>> {
  await requireProduction();
  const parsed = z.object({ projectId: z.uuid(), serviceIds: z.array(z.uuid()) }).safeParse({ projectId, serviceIds });
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const current = await tasksState(supabase, projectId);
  const added = serviceIds.filter((id) => !current.serviceIds.includes(id));
  const removed = current.serviceIds.filter((id) => !serviceIds.includes(id));

  if (removed.length) {
    const { error } = await supabase.from("project_tasks").delete().eq("project_id", projectId).in("service_id", removed);
    if (error) return fail(error);
    const { error: psError } = await supabase.from("project_services").delete().eq("project_id", projectId).in("service_id", removed);
    if (psError) return fail(psError);
  }
  if (added.length) {
    const { data: project } = await supabase.from("projects").select("start_date").eq("id", projectId).single<{ start_date: string | null }>();
    const error = await addServices(supabase, projectId, added, project?.start_date ?? null);
    if (error) return fail(error);
  }
  revalidateProjects(projectId);
  return ok(await tasksState(supabase, projectId));
}

const taskPatch = z
  .object({
    title: z.string().trim().min(1, "Scrie ce ai de făcut").max(300),
    due_date: date,
    done: z.boolean(),
  })
  .partial();

/** Bifează / debifează un pas, îi schimbă numele sau termenul. */
export async function updateTask(id: string, patch: z.input<typeof taskPatch>): Promise<Result<TasksState>> {
  await requireProduction();
  const parsed = taskPatch.safeParse(patch);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { done, ...rest } = parsed.data;
  const update = { ...rest, ...(done === undefined ? {} : { done_at: done ? todayISO() : null }) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_tasks").update(update).eq("id", id).select("project_id").single<{ project_id: string }>();
  if (error) return fail(error);
  revalidateProjects(data.project_id);
  return ok(await tasksState(supabase, data.project_id));
}

/** Pas nou, la finalul serviciului (sau la „Altele”, fără serviciu). */
export async function addTask(projectId: string, serviceId: string | null, title: string): Promise<Result<TasksState>> {
  await requireProduction();
  const parsed = z
    .object({ projectId: z.uuid(), serviceId: z.uuid().nullable(), title: z.string().trim().min(1, "Scrie ce ai de făcut").max(300) })
    .safeParse({ projectId, serviceId, title });
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  let last = supabase.from("project_tasks").select("sort_order").eq("project_id", projectId);
  last = serviceId ? last.eq("service_id", serviceId) : last.is("service_id", null);
  const { data: lastRow } = await last.order("sort_order", { ascending: false }).limit(1).maybeSingle<{ sort_order: number }>();
  const { error } = await supabase
    .from("project_tasks")
    .insert({ project_id: projectId, service_id: serviceId, title: parsed.data.title, sort_order: (lastRow?.sort_order ?? 0) + 10 });
  if (error) return fail(error);
  revalidateProjects(projectId);
  return ok(await tasksState(supabase, projectId));
}

export async function deleteTask(id: string): Promise<Result<TasksState>> {
  await requireProduction();
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_tasks").delete().eq("id", id).select("project_id").single<{ project_id: string }>();
  if (error) return fail(error);
  revalidateProjects(data.project_id);
  return ok(await tasksState(supabase, data.project_id));
}

/** Noua ordine a pașilor (id-urile în ordinea dorită). */
export async function reorderTasks(projectId: string, ids: string[]): Promise<Result<TasksState>> {
  await requireProduction();
  const parsed = z.array(z.uuid()).max(500).safeParse(ids);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  for (const [index, id] of parsed.data.entries()) {
    const { error } = await supabase.from("project_tasks").update({ sort_order: (index + 1) * 10 }).eq("id", id).eq("project_id", projectId);
    if (error) return fail(error);
  }
  revalidateProjects(projectId);
  return ok(await tasksState(supabase, projectId));
}

// ---------------------------------------------------------------------
// Tranșe și costuri (tranzacții legate de proiect)
// ---------------------------------------------------------------------

async function projectTransactions(projectId: string): Promise<Transaction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select(TX_COLUMNS)
    .eq("project_id", projectId)
    .order("due_date")
    .order("created_at")
    .returns<Transaction[]>();
  return data ?? [];
}

const txSchema = z.object({
  amount: moneyInput.refine((v) => Number(v) > 0, "Suma trebuie să fie mai mare ca 0"),
  status: z.enum(["planned", "realized"]),
  due_date: z.iso.date("Dată invalidă"),
  realized_date: date,
  cost_type_id: z.uuid().nullable(),
  category_id: z.uuid().nullable(),
  person: text,
  actor_id: z.uuid().nullable(),
  description: text,
});

/** Statusul „realizat” fără dată efectivă primește data de azi; „planificat” o șterge. */
function normalizeStatus<T extends { status?: "planned" | "realized"; realized_date?: string | null }>(data: T): T {
  if (data.status === "realized" && !data.realized_date) return { ...data, realized_date: todayISO() };
  if (data.status === "planned") return { ...data, realized_date: null };
  return data;
}

export async function createProjectTransaction(
  projectId: string,
  kind: "installment" | "project_cost",
  values: Record<string, unknown>,
): Promise<Result<Transaction[]>> {
  await requireAdmin();
  const parsed = txSchema
    .partial({ realized_date: true, cost_type_id: true, category_id: true, person: true, actor_id: true, description: true })
    .safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  let categoryId = parsed.data.category_id ?? null;
  if (kind === "project_cost" && !categoryId && parsed.data.cost_type_id) {
    const { data: ct } = await supabase
      .from("cost_types")
      .select("default_category_id")
      .eq("id", parsed.data.cost_type_id)
      .single<{ default_category_id: string | null }>();
    categoryId = ct?.default_category_id ?? null;
  }

  const { error } = await supabase.from("transactions").insert(
    normalizeStatus({
      ...parsed.data,
      category_id: kind === "installment" ? null : categoryId,
      type: kind === "installment" ? "income" : "expense",
      kind,
      project_id: projectId,
    }),
  );
  if (error) return fail(error);
  revalidateProjects(projectId);
  return ok(await projectTransactions(projectId));
}

export async function updateProjectTransaction(id: string, patch: Record<string, unknown>): Promise<Result<Transaction[]>> {
  await requireAdmin();
  const parsed = txSchema.partial().safeParse(patch);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("transactions")
    .select("project_id, kind")
    .eq("id", id)
    .single<{ project_id: string; kind: string }>();
  if (!current) return { ok: false, error: "Tranzacția nu mai există." };

  const update: Record<string, unknown> = normalizeStatus(parsed.data);
  // Comisionul modificat de mână nu mai e recalculat automat.
  if (current.kind === "commission" && ("amount" in parsed.data || "due_date" in parsed.data)) update.manual_override = true;
  if ("cost_type_id" in parsed.data && parsed.data.cost_type_id && !("category_id" in parsed.data)) {
    const { data: ct } = await supabase
      .from("cost_types")
      .select("default_category_id")
      .eq("id", parsed.data.cost_type_id)
      .single<{ default_category_id: string | null }>();
    if (ct?.default_category_id) update.category_id = ct.default_category_id;
  }

  const { error } = await supabase.from("transactions").update(update).eq("id", id);
  if (error) return fail(error);
  revalidateProjects(current.project_id);
  return ok(await projectTransactions(current.project_id));
}

export async function deleteProjectTransaction(id: string): Promise<Result<Transaction[]>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("transactions")
    .select("project_id, kind")
    .eq("id", id)
    .single<{ project_id: string; kind: string }>();
  if (!current) return { ok: false, error: "Tranzacția nu mai există." };
  if (current.kind === "commission") {
    return { ok: false, error: "Comisionul se oprește din „Comision activ” în secțiunea de sus, nu prin ștergere." };
  }
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return fail(error);
  revalidateProjects(current.project_id);
  return ok(await projectTransactions(current.project_id));
}

/** Readuce comisionul la calculul automat (procent × valoare contract). */
export async function resetCommission(projectId: string): Promise<Result<Transaction[]>> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ manual_override: false })
    .eq("project_id", projectId)
    .eq("kind", "commission")
    .eq("status", "planned");
  if (error) return fail(error);
  // Orice update pe project_finance declanșează recalcularea.
  await supabase.from("project_finance").update({ updated_at: new Date().toISOString() }).eq("project_id", projectId);
  revalidateProjects(projectId);
  return ok(await projectTransactions(projectId));
}

// ---------------------------------------------------------------------
// Actori pe proiect
// ---------------------------------------------------------------------

export async function addProjectActor(projectId: string, actorId: string, agreedFee: string | null): Promise<Result> {
  await requireProduction();
  const fee = agreedFee ? moneyInput.safeParse(agreedFee) : null;
  if (fee && !fee.success) return invalid(fee.error.issues);
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_actors")
    .insert({ project_id: projectId, actor_id: actorId, agreed_fee: fee?.data ?? null });
  if (error) return fail(error);
  revalidateProjects(projectId);
  return ok(null);
}

export async function updateProjectActor(id: string, patch: { agreed_fee?: string | null; role_notes?: string | null }): Promise<Result> {
  await requireProduction();
  const parsed = z.object({ agreed_fee: moneyInput.nullable().optional(), role_notes: text.optional() }).safeParse(patch);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_actors")
    .update(parsed.data)
    .eq("id", id)
    .select("project_id")
    .single<{ project_id: string }>();
  if (error) return fail(error);
  revalidateProjects(data.project_id);
  return ok(null);
}

export async function removeProjectActor(id: string): Promise<Result> {
  await requireProduction();
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_actors").delete().eq("id", id).select("project_id").single<{ project_id: string }>();
  if (error) return fail(error);
  revalidateProjects(data.project_id);
  return ok(null);
}

/** Adaugă costul actorului ca linie de cost planificată pe proiect. */
export async function addActorCost(projectActorId: string): Promise<Result<Transaction[]>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: pa } = await supabase
    .from("project_actors")
    .select("project_id, agreed_fee, actor:actors(id, name, rate)")
    .eq("id", projectActorId)
    .single<{ project_id: string; agreed_fee: string | null; actor: { id: string; name: string; rate: string | null } }>();
  if (!pa) return { ok: false, error: "Actorul nu mai e alocat proiectului." };
  const amount = pa.agreed_fee ?? pa.actor.rate;
  if (!amount || Number(amount) <= 0) return { ok: false, error: "Completează întâi onorariul convenit sau tariful actorului." };

  const { data: costType } = await supabase
    .from("cost_types")
    .select("id, default_category_id")
    .ilike("name", "actor")
    .maybeSingle<{ id: string; default_category_id: string | null }>();

  const { data: project } = await supabase
    .from("projects")
    .select("start_date")
    .eq("id", pa.project_id)
    .single<{ start_date: string | null }>();

  const { error } = await supabase.from("transactions").insert({
    type: "expense",
    kind: "project_cost",
    amount,
    status: "planned",
    due_date: project?.start_date && project.start_date > todayISO() ? project.start_date : todayISO(),
    project_id: pa.project_id,
    cost_type_id: costType?.id ?? null,
    category_id: costType?.default_category_id ?? null,
    person: pa.actor.name,
    actor_id: pa.actor.id,
  });
  if (error) return fail(error);
  revalidateProjects(pa.project_id);
  return ok(await projectTransactions(pa.project_id));
}
