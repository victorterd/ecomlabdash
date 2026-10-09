import "server-only";
import { isMissingRelation } from "@/lib/db-errors";
import { TX_COLUMNS, type Transaction } from "@/lib/projects/types";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory, FinanceSettings } from "@/lib/types";

export type RecurringExpense = {
  id: string;
  description: string;
  amount: string;
  category_id: string | null;
  scope: "business" | "personal";
  day_of_month: number;
  start_month: string;
  end_month: string | null;
  active: boolean;
  is_seed: boolean;
};

export type ForecastEntry = { id: string; month: string; type: "income" | "expense"; category_id: string | null; amount: string };

export type TransactionRow = Transaction & {
  project: { id: string; client_name: string } | null;
  recurring_rule_id: string | null;
};

const PAGE = 1000;

/** Toate tranzacțiile (opțional într-un interval de date efective), cu numele proiectului. */
export async function fetchTransactions(range?: { from?: string; to?: string }): Promise<TransactionRow[]> {
  const supabase = await createClient();
  const all: TransactionRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("transactions")
      .select(`${TX_COLUMNS}, recurring_rule_id, project:projects(id, client_name)`)
      .order("effective_date")
      .order("id")
      .range(from, from + PAGE - 1);
    if (range?.from) query = query.gte("effective_date", range.from);
    if (range?.to) query = query.lte("effective_date", range.to);
    const { data, error } = await query.returns<TransactionRow[]>();
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

export async function fetchFinanceSettings(): Promise<FinanceSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("finance_settings").select("*").single<FinanceSettings>();
  return (
    data ?? {
      setter_commission_pct: "15",
      profit_tax_pct: "16",
      dividend_tax_pct: "16",
      opening_balance: "0",
      opening_balance_date: "2026-01-01",
    }
  );
}

export async function fetchCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("expense_categories").select("*").order("sort_order").returns<ExpenseCategory[]>();
  return data ?? [];
}

/**
 * Generează cheltuielile recurente planificate pentru următoarele 12 luni (idempotent).
 * Întoarce false dacă migrația Etapei 4 nu a fost rulată.
 */
export async function ensureFinanceReady(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_recurring_transactions", { p_months: 12 });
  return !isMissingRelation(error);
}

export async function fetchRecurring(): Promise<RecurringExpense[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_expenses")
    .select("*")
    .order("active", { ascending: false })
    .order("description")
    .returns<RecurringExpense[]>();
  return data ?? [];
}

export async function fetchForecast(fromMonth: string, toMonth: string): Promise<ForecastEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("forecast_entries")
    .select("id, month, type, category_id, amount")
    .gte("month", fromMonth)
    .lte("month", toMonth)
    .returns<ForecastEntry[]>();
  return data ?? [];
}

export async function fetchProjectOptionsForFinance(): Promise<{ id: string; client_name: string; archived: boolean }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, client_name, archived")
    .order("archived")
    .order("client_name")
    .returns<{ id: string; client_name: string; archived: boolean }[]>();
  return data ?? [];
}
