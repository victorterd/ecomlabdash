"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { type DuplicateMatch, LEAD_COLUMNS, type Lead, type LeadActivity, type StatusHistoryEntry } from "@/lib/leads/types";
import { cleanPhone } from "@/lib/leads/normalize";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { timeInput } from "@/lib/validation";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireLeadAccess() {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "setter") throw new Error("Nu ai acces la lead-uri");
  return profile;
}

function errorMessage(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  if (e?.code === "23503") return "Statusul sau sursa aleasă nu mai există.";
  return e?.message || "A apărut o eroare.";
}

const optionalText = z
  .string()
  .trim()
  .max(5000)
  .nullable()
  .transform((v) => (v ? v : null));

const phone = optionalText.transform((v) => (v ? cleanPhone(v) : null));

const leadSchema = z.object({
  company_name: z.string().trim().min(1, "Numele companiei e obligatoriu").max(300),
  website: optionalText,
  owner_name: optionalText,
  email: optionalText,
  phone1: phone,
  phone2: phone,
  status_id: z.uuid("Status invalid"),
  source_id: z.uuid().nullable(),
  called_by: optionalText,
  follow_up_date: z.iso.date("Dată invalidă").nullable(),
  follow_up_time: timeInput.nullable(),
  potential: optionalText,
  notes: z
    .string()
    .max(50000)
    .nullable()
    .transform((v) => (v?.trim() ? v : null)),
});

const leadPatchSchema = leadSchema.partial();

// ---------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------

export type DuplicateCheckRow = { website?: string | null; email?: string | null; phone1?: string | null; phone2?: string | null };

export type DuplicateCheckResult = {
  domains: string[];
  phones: string[];
  email: string | null;
  match: DuplicateMatch | null;
};

/** Verifică o listă de lead-uri față de baza de date; rezultatul e în aceeași ordine. */
export async function checkDuplicates(rows: DuplicateCheckRow[], excludeId?: string): Promise<Result<DuplicateCheckResult[]>> {
  await requireLeadAccess();
  if (rows.length === 0) return { ok: true, data: [] };
  if (rows.length > 2000) return { ok: false, error: "Prea multe rânduri într-o singură verificare." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_lead_duplicates", { p_rows: rows, p_exclude: excludeId ?? null });
  if (error) return { ok: false, error: errorMessage(error) };

  type Row = {
    idx: number;
    domains: string[];
    phones: string[];
    email: string | null;
    lead_id: string | null;
    company_name: string | null;
    matched_on: DuplicateMatch["matched_on"] | null;
  };
  return {
    ok: true,
    data: (data as Row[]).map((r) => ({
      domains: r.domains,
      phones: r.phones,
      email: r.email,
      match: r.lead_id ? { lead_id: r.lead_id, company_name: r.company_name ?? "", matched_on: r.matched_on ?? "website" } : null,
    })),
  };
}

// ---------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------

export async function createLead(
  values: Record<string, unknown>,
  force = false,
): Promise<Result<Lead> | { ok: false; duplicate: DuplicateMatch }> {
  await requireLeadAccess();
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Date invalide" };

  if (!force) {
    const check = await checkDuplicates([parsed.data]);
    if (check.ok && check.data[0]?.match) return { ok: false, duplicate: check.data[0].match };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").insert(parsed.data).select(LEAD_COLUMNS).single<Lead>();
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function updateLead(id: string, patch: Record<string, unknown>): Promise<Result<Lead>> {
  await requireLeadAccess();
  const parsedId = z.uuid().safeParse(id);
  const parsed = leadPatchSchema.safeParse(patch);
  if (!parsedId.success || !parsed.success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Date invalide" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").update(parsed.data).eq("id", parsedId.data).select(LEAD_COLUMNS).single<Lead>();
  if (error) return { ok: false, error: errorMessage(error) };
  // Badge-ul din sidebar (follow-up-uri restante) depinde de lead-uri.
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function deleteLead(id: string): Promise<Result<null>> {
  await requireLeadAccess();
  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export type LeadHistory = { statuses: StatusHistoryEntry[]; activities: LeadActivity[] };

export async function getLeadHistory(id: string): Promise<Result<LeadHistory>> {
  await requireLeadAccess();
  const supabase = await createClient();
  const [statuses, activities] = await Promise.all([
    supabase
      .from("lead_status_history")
      .select("id, from_status_id, to_status_id, changed_at")
      .eq("lead_id", id)
      .order("changed_at", { ascending: false })
      .returns<StatusHistoryEntry[]>(),
    supabase
      .from("lead_activities")
      .select("id, done_on, note, status_id, next_follow_up, created_at")
      .eq("lead_id", id)
      .order("done_on", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<LeadActivity[]>(),
  ]);
  if (statuses.error) return { ok: false, error: errorMessage(statuses.error) };
  // Fără migrația follow-up-urilor, istoricul arată doar statusurile.
  return { ok: true, data: { statuses: statuses.data, activities: activities.data ?? [] } };
}

/** Lead-ul cu datele de care are nevoie fereastra „Am făcut follow-up”. */
export async function getLead(id: string): Promise<Result<Lead>> {
  await requireLeadAccess();
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select(LEAD_COLUMNS).eq("id", id).single<Lead>();
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data };
}

const followUpSchema = z.object({
  done_on: z.iso.date("Dată invalidă"),
  note: optionalText,
  status_id: z.uuid("Alege rezultatul"),
  next_follow_up: z.iso.date("Dată invalidă").nullable(),
  next_time: timeInput.nullable(),
});

/**
 * „Am făcut follow-up”: salvează ce s-a întâmplat în istoric, schimbă statusul
 * și pune data următorului follow-up (sau o scoate, dacă nu mai e nevoie).
 */
export async function logFollowUp(leadId: string, values: z.input<typeof followUpSchema>): Promise<Result<Lead>> {
  await requireLeadAccess();
  const parsedId = z.uuid().safeParse(leadId);
  const parsed = followUpSchema.safeParse(values);
  if (!parsedId.success || !parsed.success) return { ok: false, error: parsed.error?.issues[0]?.message ?? "Date invalide" };
  const v = parsed.data;
  if (v.done_on > todayISO()) return { ok: false, error: "Data follow-up-ului nu poate fi în viitor." };

  const supabase = await createClient();
  const { error: logError } = await supabase.from("lead_activities").insert({
    lead_id: parsedId.data,
    done_on: v.done_on,
    note: v.note,
    status_id: v.status_id,
    next_follow_up: v.next_follow_up,
  });
  if (logError) {
    if (logError.code === "PGRST205" || logError.code === "42P01") {
      return { ok: false, error: "Rulează în Supabase migrația 20261016000008_lead_activities.sql." };
    }
    return { ok: false, error: errorMessage(logError) };
  }

  const { data, error } = await supabase
    .from("leads")
    .update({ status_id: v.status_id, follow_up_date: v.next_follow_up, follow_up_time: v.next_follow_up ? v.next_time : null })
    .eq("id", parsedId.data)
    .select(LEAD_COLUMNS)
    .single<Lead>();
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, data };
}

// ---------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------

export async function startImport(fileName: string, totalRows: number, mapping: unknown): Promise<Result<string>> {
  await requireLeadAccess();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_imports")
    .insert({ file_name: fileName.slice(0, 300), total_rows: totalRows, mapping })
    .select("id")
    .single<{ id: string }>();
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data.id };
}

const importRowSchema = leadSchema.extend({ force: z.boolean().default(false) });

export type ImportChunkResult = { imported: number; duplicates: number; errors: { row: number; error: string }[] };

/**
 * Importă un lot de rânduri. Rândurile fără `force` sunt verificate din nou față de
 * baza de date și sărite dacă sunt duplicate (inclusiv față de loturile anterioare).
 */
export async function importLeadsChunk(
  importId: string,
  rows: { row: number; values: Record<string, unknown> }[],
): Promise<Result<ImportChunkResult>> {
  await requireLeadAccess();
  if (rows.length > 500) return { ok: false, error: "Lot prea mare" };

  const result: ImportChunkResult = { imported: 0, duplicates: 0, errors: [] };
  const valid: { row: number; force: boolean; data: z.infer<typeof leadSchema> }[] = [];
  for (const r of rows) {
    const parsed = importRowSchema.safeParse(r.values);
    if (!parsed.success) {
      result.errors.push({ row: r.row, error: parsed.error.issues[0]?.message ?? "Date invalide" });
      continue;
    }
    const { force, ...data } = parsed.data;
    valid.push({ row: r.row, force, data });
  }

  const check = await checkDuplicates(valid.map((v) => v.data));
  if (!check.ok) return check;

  const toInsert = valid.filter((v, i) => {
    if (!v.force && check.data[i]?.match) {
      result.duplicates++;
      return false;
    }
    return true;
  });

  if (toInsert.length) {
    const supabase = await createClient();
    const { error } = await supabase.from("leads").insert(toInsert.map((v) => ({ ...v.data, import_id: importId })));
    if (error) {
      // Un rând greșit blochează tot lotul; reîncercăm unul câte unul ca să aflăm care.
      for (const v of toInsert) {
        const single = await supabase.from("leads").insert({ ...v.data, import_id: importId });
        if (single.error) result.errors.push({ row: v.row, error: errorMessage(single.error) });
        else result.imported++;
      }
    } else {
      result.imported += toInsert.length;
    }
  }
  return { ok: true, data: result };
}

export async function finishImport(
  importId: string,
  summary: { imported: number; skipped_duplicates: number; skipped_manual: number; errors: { row: number; error: string }[] },
): Promise<Result<null>> {
  await requireLeadAccess();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_imports")
    .update({ ...summary, errors: summary.errors.slice(0, 500) })
    .eq("id", importId);
  revalidatePath("/", "layout");
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: null };
}
