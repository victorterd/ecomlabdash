"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { moneyInput, percentInput, timeInput } from "@/lib/validation";
import { isListTable, LIST_SCHEMAS } from "./lists";

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return { ok: false, error: "Există deja un element cu acest nume." };
    if (code === "23503") return { ok: false, error: "Elementul e folosit în date existente și nu poate fi șters. Îl poți dezactiva." };
  }
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
  return { ok: false, error: message || "A apărut o eroare." };
}

function done(): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Liste configurabile
// ---------------------------------------------------------------------

export async function updateListItem(table: string, id: string, values: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin();
  if (!isListTable(table)) return { ok: false, error: "Listă necunoscută" };
  const parsed = LIST_SCHEMAS[table].safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Date invalide" };

  const supabase = await createClient();
  // Un singur status poate fi „implicit” pentru lead-urile noi.
  if (table === "lead_statuses" && (parsed.data as { is_default?: boolean }).is_default) {
    const { error } = await supabase.from("lead_statuses").update({ is_default: false }).neq("id", id).eq("is_default", true);
    if (error) return fail(error);
  }
  const { error } = await supabase.from(table).update(parsed.data).eq("id", id);
  return error ? fail(error) : done();
}

export async function createListItem(table: string, values: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin();
  if (!isListTable(table)) return { ok: false, error: "Listă necunoscută" };
  const parsed = LIST_SCHEMAS[table].safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Date invalide" };
  if (!("name" in parsed.data)) return { ok: false, error: "Numele e obligatoriu" };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  const { error } = await supabase.from(table).insert({ ...parsed.data, sort_order: (last?.sort_order ?? 0) + 10 });
  return error ? fail(error) : done();
}

export async function deleteListItem(table: string, id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isListTable(table)) return { ok: false, error: "Listă necunoscută" };
  const supabase = await createClient();

  if (table === "lead_statuses") {
    const { count } = await supabase.from("lead_statuses").select("id", { count: "exact", head: true });
    if ((count ?? 0) <= 1) return { ok: false, error: "Trebuie să existe cel puțin un status." };
  }
  if (table === "cost_types") {
    const { data } = await supabase.from("cost_types").select("is_commission").eq("id", id).single<{ is_commission: boolean }>();
    if (data?.is_commission) return { ok: false, error: "Tipul de cost pentru comision nu poate fi șters." };
  }

  const { error } = await supabase.from(table).delete().eq("id", id);
  return error ? fail(error) : done();
}

export async function reorderList(table: string, orderedIds: string[]): Promise<ActionResult> {
  await requireAdmin();
  if (!isListTable(table)) return { ok: false, error: "Listă necunoscută" };
  const ids = z.array(z.uuid()).safeParse(orderedIds);
  if (!ids.success) return { ok: false, error: "Ordine invalidă" };

  const supabase = await createClient();
  const results = await Promise.all(
    ids.data.map((id, index) =>
      supabase
        .from(table)
        .update({ sort_order: (index + 1) * 10 })
        .eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  return failed?.error ? fail(failed.error) : done();
}

// ---------------------------------------------------------------------
// Setări generale
// ---------------------------------------------------------------------

const appSettingsSchema = z
  .object({
    follow_up_days: z.coerce.number().int().min(0, "Minim 0 zile").max(365),
    follow_up_default_time: timeInput,
    deadline_warning_days: z.coerce.number().int().min(0).max(90),
    daily_email_time: timeInput,
  })
  .partial();

export async function saveAppSettings(values: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = appSettingsSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Date invalide" };
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").update(parsed.data).eq("id", true);
  return error ? fail(error) : done();
}

const financeSettingsSchema = z
  .object({
    setter_commission_pct: percentInput,
    profit_tax_pct: percentInput,
    dividend_tax_pct: percentInput,
    opening_balance: moneyInput,
    opening_balance_date: z.iso.date("Dată invalidă"),
  })
  .partial();

export async function saveFinanceSettings(values: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = financeSettingsSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Date invalide" };
  const supabase = await createClient();
  const { error } = await supabase.from("finance_settings").update(parsed.data).eq("id", true);
  return error ? fail(error) : done();
}

// ---------------------------------------------------------------------
// Notificări (per utilizator)
// ---------------------------------------------------------------------

const prefsSchema = z
  .object({
    email_daily: z.boolean(),
    push_enabled: z.boolean(),
    notify_followups: z.boolean(),
    notify_followup_at_time: z.boolean(),
    notify_installments: z.boolean(),
    notify_payments: z.boolean(),
    notify_shoots: z.boolean(),
    notify_stage_deadlines: z.boolean(),
    email_to: z.union([z.email("Email invalid"), z.literal("").transform(() => null)]).nullable(),
  })
  .partial();

export async function saveNotificationPrefs(values: Record<string, unknown>): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = prefsSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Date invalide" };
  const supabase = await createClient();
  const { error } = await supabase.from("notification_prefs").upsert({ user_id: profile.id, ...parsed.data }, { onConflict: "user_id" });
  return error ? fail(error) : done();
}

// ---------------------------------------------------------------------
// Profil și utilizatori
// ---------------------------------------------------------------------

export async function saveProfileName(fullName: string): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = z.string().trim().min(1, "Numele e obligatoriu").max(80).safeParse(fullName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data }).eq("id", profile.id);
  return error ? fail(error) : done();
}

export async function setUserRole(userId: string, role: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.object({ userId: z.uuid(), role: z.enum(["admin", "setter", "productie"]) }).safeParse({ userId, role });
  if (!parsed.success) return { ok: false, error: "Date invalide" };
  if (parsed.data.userId === admin.id && parsed.data.role !== "admin") {
    return { ok: false, error: "Nu îți poți scoate singur rolul de admin." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role: parsed.data.role }).eq("id", parsed.data.userId);
  return error ? fail(error) : done();
}
