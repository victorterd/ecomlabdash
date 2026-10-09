import "server-only";
import { isMissingRelation } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import type { LeadSource, LeadStatus } from "@/lib/types";
import { LEAD_COLUMNS, type Lead } from "./types";

const PAGE = 1000; // limita implicită de rânduri per request în Supabase

/** `null` dacă tabela de lead-uri nu există încă (migrația Etapei 2 nerulată). */
export async function fetchAllLeads(): Promise<Lead[] | null> {
  const supabase = await createClient();
  const all: Lead[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1)
      .returns<Lead[]>();
    if (error) {
      if (isMissingRelation(error)) return null;
      throw new Error(error.message);
    }
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

export async function fetchLeadLists() {
  const supabase = await createClient();
  const [{ data: statuses }, { data: sources }] = await Promise.all([
    supabase.from("lead_statuses").select("*").order("sort_order").returns<LeadStatus[]>(),
    supabase.from("lead_sources").select("*").order("sort_order").returns<LeadSource[]>(),
  ]);
  return { statuses: statuses ?? [], sources: sources ?? [] };
}

/** Lead-uri cu follow-up azi sau depășit, care nu sunt pe un status închis (badge în sidebar). */
export async function countDueFollowUps(today: string): Promise<number> {
  const supabase = await createClient();
  const { data: closed } = await supabase.from("lead_statuses").select("id").eq("is_closed", true).returns<{ id: string }[]>();
  let query = supabase.from("leads").select("id", { count: "exact", head: true }).lte("follow_up_date", today);
  const closedIds = (closed ?? []).map((s) => s.id);
  if (closedIds.length) query = query.not("status_id", "in", `(${closedIds.join(",")})`);
  const { count } = await query;
  return count ?? 0;
}

export async function leadsTableExists(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("leads").select("id", { head: true, count: "exact" }).limit(1);
  return !isMissingRelation(error);
}
