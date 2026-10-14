"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, invalid, ok, type Result } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { moneyInput } from "@/lib/validation";

const text = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .transform((v) => v || null);

function revalidateFinance(projectId?: string | null) {
  revalidatePath("/financiar", "layout");
  revalidatePath("/", "layout");
  if (projectId) revalidatePath(`/proiecte/${projectId}`);
  revalidatePath("/proiecte");
}

// ---------------------------------------------------------------------
// Tranzacții
// ---------------------------------------------------------------------

const txSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    amount: moneyInput.refine((v) => Number(v) > 0, "Suma trebuie să fie mai mare ca 0"),
    status: z.enum(["planned", "realized"]),
    due_date: z.iso.date("Alege data"),
    realized_date: z.iso.date().nullable(),
    category_id: z.uuid().nullable(),
    scope: z.enum(["business", "personal"]),
    project_id: z.uuid().nullable(),
    description: text,
    person: text,
  })
  .superRefine((v, ctx) => {
    if (v.type === "expense" && !v.category_id)
      ctx.addIssue({ code: "custom", message: "Alege categoria cheltuielii", path: ["category_id"] });
  });

export async function saveTransaction(id: string | null, values: Record<string, unknown>): Promise<Result> {
  await requireAdmin();
  const parsed = txSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues);
  const data = { ...parsed.data };
  if (data.type === "income") {
    data.category_id = null;
    data.scope = "business";
  }
  // Status realizat fără dată efectivă = realizat la data tranzacției.
  data.realized_date = data.status === "realized" ? (data.realized_date ?? data.due_date) : null;

  const supabase = await createClient();
  if (id) {
    const { data: current } = await supabase
      .from("transactions")
      .select("kind, project_id")
      .eq("id", id)
      .single<{ kind: string; project_id: string | null }>();
    if (!current) return { ok: false, error: "Tranzacția nu mai există." };
    const update: Record<string, unknown> = { ...data };
    if (current.kind === "commission") update.manual_override = true;
    const { error } = await supabase.from("transactions").update(update).eq("id", id);
    if (error) return fail(error);
    revalidateFinance(current.project_id ?? data.project_id);
  } else {
    const { error } = await supabase.from("transactions").insert({ ...data, kind: "manual" });
    if (error) return fail(error);
    revalidateFinance(data.project_id);
  }
  return ok(null);
}

export async function setTransactionStatus(id: string, status: "planned" | "realized", date?: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({ status, realized_date: status === "realized" ? (date ?? todayISO()) : null })
    .eq("id", id)
    .select("project_id")
    .single<{ project_id: string | null }>();
  if (error) return fail(error);
  revalidateFinance(data.project_id);
  return ok(null);
}

export async function deleteTransaction(id: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("transactions")
    .select("kind, project_id")
    .eq("id", id)
    .single<{ kind: string; project_id: string | null }>();
  if (!current) return { ok: false, error: "Tranzacția nu mai există." };
  if (current.kind === "commission") return { ok: false, error: "Comisionul se oprește din pagina proiectului (Comision setter)." };
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return fail(error);
  revalidateFinance(current.project_id);
  return ok(null);
}

export async function createCategory(
  name: string,
): Promise<Result<{ id: string; name: string; color: string; sort_order: number; active: boolean }>> {
  await requireAdmin();
  const parsed = z.string().trim().min(1, "Scrie numele categoriei").max(80).safeParse(name);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("expense_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();
  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ name: parsed.data, sort_order: (last?.sort_order ?? 0) + 10 })
    .select("id, name, color, sort_order, active")
    .single<{ id: string; name: string; color: string; sort_order: number; active: boolean }>();
  if (error) return fail(error);
  revalidatePath("/setari/financiar");
  revalidateFinance();
  return ok(data);
}

// ---------------------------------------------------------------------
// Cheltuieli recurente
// ---------------------------------------------------------------------

const recurringSchema = z.object({
  description: z.string().trim().min(1, "Scrie descrierea").max(300),
  amount: moneyInput.refine((v) => Number(v) > 0, "Suma trebuie să fie mai mare ca 0"),
  category_id: z.uuid("Alege categoria"),
  scope: z.enum(["business", "personal"]),
  day_of_month: z.coerce.number().int().min(1, "Zi între 1 și 31").max(31, "Zi între 1 și 31"),
  start_month: z.iso.date("Alege luna de început"),
  end_month: z.iso.date().nullable(),
  active: z.boolean(),
});

const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

export async function saveRecurring(id: string | null, values: Record<string, unknown>): Promise<Result> {
  await requireAdmin();
  const parsed = recurringSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues);
  const data = {
    ...parsed.data,
    start_month: firstOfMonth(parsed.data.start_month),
    end_month: parsed.data.end_month ? firstOfMonth(parsed.data.end_month) : null,
  };
  if (data.end_month && data.end_month < data.start_month) return { ok: false, error: "Luna de final e înaintea celei de început." };

  const supabase = await createClient();
  const query = id ? supabase.from("recurring_expenses").update(data).eq("id", id) : supabase.from("recurring_expenses").insert(data);
  const { data: saved, error } = await query.select("id").single<{ id: string }>();
  if (error) return fail(error);
  const { error: refreshError } = await supabase.rpc("refresh_recurring_rule", { p_rule_id: saved.id });
  if (refreshError) return fail(refreshError);
  revalidateFinance();
  return ok(null);
}

export async function deleteRecurring(id: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  // Lunile viitoare neplătite dispar; cele plătite rămân în istoric.
  await supabase
    .from("transactions")
    .delete()
    .eq("recurring_rule_id", id)
    .eq("status", "planned")
    .gte("period_month", firstOfMonth(todayISO()));
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) return fail(error);
  revalidateFinance();
  return ok(null);
}

// ---------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Forecast P&L: proiecte estimate și costuri fixe, pe lună
// ---------------------------------------------------------------------

export type ForecastRow = Record<string, string | number> & { id: string };

const monthDate = z.string().regex(/^\d{4}-\d{2}-01$/, "Lună invalidă");
const label = z.string().trim().max(200);
const amount = moneyInput.nullable().transform((v) => v ?? "0");

const forecastProjectSchema = z.object({ name: label, revenue: amount, actor: amount, cameraman: amount, editor: amount }).partial();
const forecastFixedSchema = z.object({ name: label, amount }).partial();

const FORECAST_TABLES = {
  project: {
    table: "forecast_projects",
    schema: forecastProjectSchema,
    columns: "id, month, name, revenue, actor, cameraman, editor, sort_order",
  },
  fixed: { table: "forecast_fixed_costs", schema: forecastFixedSchema, columns: "id, month, name, amount, sort_order" },
} as const;

export type ForecastKind = keyof typeof FORECAST_TABLES;

function forecastDone<T>(data: T): Result<T> {
  revalidatePath("/financiar/forecast");
  return ok(data);
}

/** Rând nou (gol) la finalul lunii. */
export async function addForecastRow(
  kind: ForecastKind,
  month: string,
  values: Record<string, unknown> = {},
): Promise<Result<ForecastRow>> {
  await requireAdmin();
  const def = FORECAST_TABLES[kind];
  const parsedMonth = monthDate.safeParse(month);
  const parsed = def.schema.safeParse(values);
  if (!parsedMonth.success) return invalid(parsedMonth.error.issues);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data: last } = await supabase
    .from(def.table)
    .select("sort_order")
    .eq("month", month)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();
  const { data, error } = await supabase
    .from(def.table)
    .insert({ month, ...parsed.data, sort_order: (last?.sort_order ?? 0) + 10 })
    .select(def.columns)
    .single<ForecastRow>();
  if (error) return fail(error);
  return forecastDone(data);
}

export async function updateForecastRow(kind: ForecastKind, id: string, values: Record<string, unknown>): Promise<Result<ForecastRow>> {
  await requireAdmin();
  const def = FORECAST_TABLES[kind];
  const parsed = def.schema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase.from(def.table).update(parsed.data).eq("id", id).select(def.columns).single<ForecastRow>();
  if (error) return fail(error);
  return forecastDone(data);
}

export async function deleteForecastRow(kind: ForecastKind, id: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from(FORECAST_TABLES[kind].table).delete().eq("id", id);
  if (error) return fail(error);
  return forecastDone(null);
}

/** Copiază proiectele estimate și costurile fixe dintr-o lună în alta (care trebuie să fie goală). */
export async function copyForecastMonth(from: string, to: string): Promise<Result> {
  await requireAdmin();
  const parsed = z.object({ from: monthDate, to: monthDate }).safeParse({ from, to });
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  for (const def of Object.values(FORECAST_TABLES)) {
    const { count } = await supabase.from(def.table).select("id", { count: "exact", head: true }).eq("month", to);
    if (count) return { ok: false, error: "Luna are deja estimări. Șterge-le întâi dacă vrei să copiezi." };
  }
  for (const def of Object.values(FORECAST_TABLES)) {
    const { data } = await supabase.from(def.table).select(def.columns).eq("month", from).returns<ForecastRow[]>();
    if (!data?.length) continue;
    const copies = data.map((row) => {
      const copy: Record<string, unknown> = { ...row, month: to };
      delete copy.id;
      return copy;
    });
    const { error } = await supabase.from(def.table).insert(copies);
    if (error) return fail(error);
  }
  return forecastDone(null);
}

const importSchema = z
  .array(
    z.object({
      month: monthDate,
      projects: z.array(z.object({ name: label, revenue: amount, actor: amount, cameraman: amount, editor: amount })).max(200),
      fixedCosts: z.array(z.object({ name: label, amount })).max(200),
    }),
  )
  .max(24);

/** Import din Excel: lunile din fișier își înlocuiesc estimările; celelalte luni rămân neatinse. */
export async function importForecast(
  months: z.input<typeof importSchema>,
): Promise<Result<{ months: number; projects: number; fixedCosts: number }>> {
  await requireAdmin();
  const parsed = importSchema.safeParse(months);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const list = parsed.data.map((m) => m.month);
  for (const def of Object.values(FORECAST_TABLES)) {
    const { error } = await supabase.from(def.table).delete().in("month", list);
    if (error) return fail(error);
  }
  const projects = parsed.data.flatMap((m) => m.projects.map((p, i) => ({ ...p, month: m.month, sort_order: (i + 1) * 10 })));
  const fixedCosts = parsed.data.flatMap((m) => m.fixedCosts.map((c, i) => ({ ...c, month: m.month, sort_order: (i + 1) * 10 })));
  if (projects.length) {
    const { error } = await supabase.from("forecast_projects").insert(projects);
    if (error) return fail(error);
  }
  if (fixedCosts.length) {
    const { error } = await supabase.from("forecast_fixed_costs").insert(fixedCosts);
    if (error) return fail(error);
  }
  return forecastDone({ months: list.length, projects: projects.length, fixedCosts: fixedCosts.length });
}
