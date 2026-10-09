import Decimal from "decimal.js";
import { addMonths, format, parseISO } from "date-fns";
import { toDecimal } from "@/lib/format";
import type { Transaction } from "@/lib/projects/types";

/** „2026-10” */
export type MonthKey = string;

export const monthKey = (isoDate: string): MonthKey => isoDate.slice(0, 7);

export function monthRange(firstMonth: MonthKey, count: number): MonthKey[] {
  const start = parseISO(`${firstMonth}-01`);
  return Array.from({ length: count }, (_, i) => format(addMonths(start, i), "yyyy-MM"));
}

export function lastDayOfMonth(month: MonthKey): string {
  return format(addMonths(parseISO(`${month}-01`), 1).getTime() - 86_400_000, "yyyy-MM-dd");
}

export type TaxRates = { profitTaxPct: Decimal.Value; dividendTaxPct: Decimal.Value };

export type PnL = {
  revenue: Decimal;
  expBusiness: Decimal;
  expPersonal: Decimal;
  profitGeneral: Decimal;
  profitAccounting: Decimal;
  profitTax: Decimal;
  profitAfterTax: Decimal;
  dividendTax: Decimal;
  net: Decimal;
};

/**
 * Formulele cerute:
 *   Profit general      = Venituri − Cheltuieli business
 *   Profit contabil     = Venituri − Cheltuieli business − Cheltuieli personale
 *   Impozit pe profit   = Profit contabil × %   (0 dacă profitul e negativ)
 *   Profit după impozit = Profit contabil − Impozit pe profit
 *   Impozit dividende   = Profit după impozit × %   (0 dacă e negativ)
 *   Net disponibil      = Profit după impozit − Impozit dividende
 */
export function computePnL(revenue: Decimal, expBusiness: Decimal, expPersonal: Decimal, rates: TaxRates): PnL {
  const profitGeneral = revenue.minus(expBusiness);
  const profitAccounting = profitGeneral.minus(expPersonal);
  const profitTax = Decimal.max(profitAccounting, 0).times(rates.profitTaxPct).div(100).toDecimalPlaces(2);
  const profitAfterTax = profitAccounting.minus(profitTax);
  const dividendTax = Decimal.max(profitAfterTax, 0).times(rates.dividendTaxPct).div(100).toDecimalPlaces(2);
  const net = profitAfterTax.minus(dividendTax);
  return { revenue, expBusiness, expPersonal, profitGeneral, profitAccounting, profitTax, profitAfterTax, dividendTax, net };
}

export type MonthRow = PnL & { month: MonthKey; endBalance: Decimal };

export type Totals = { months: MonthRow[]; year: PnL };

const ZERO = new Decimal(0);

/** Tranzacțiile care intră în calcul: doar realizate sau realizate + planificate. */
export function includeTx(t: Pick<Transaction, "status">, withPlanned: boolean) {
  return withPlanned || t.status === "realized";
}

/** Suma cu semn pentru sold: + încasare, − cheltuială. */
export function signed(t: Pick<Transaction, "type" | "amount">): Decimal {
  const amount = toDecimal(t.amount);
  return t.type === "income" ? amount : amount.negated();
}

/**
 * Calcul pe luni. Soldul de final de lună = sold de pornire + toate mișcările
 * incluse de la data soldului de pornire până la finalul lunii (tranzacțiile
 * dinaintea datei de pornire intră în profit, dar nu în sold).
 */
export function monthlyTotals(
  transactions: Pick<Transaction, "type" | "amount" | "status" | "scope" | "effective_date">[],
  months: MonthKey[],
  withPlanned: boolean,
  rates: TaxRates,
  opening: { balance: Decimal.Value; date: string },
): Totals {
  const sums = new Map<MonthKey, { revenue: Decimal; expBusiness: Decimal; expPersonal: Decimal }>();
  for (const m of months) sums.set(m, { revenue: ZERO, expBusiness: ZERO, expPersonal: ZERO });

  const balanceMoves: { date: string; amount: Decimal }[] = [];
  for (const t of transactions) {
    if (!includeTx(t, withPlanned)) continue;
    if (t.effective_date >= opening.date) balanceMoves.push({ date: t.effective_date, amount: signed(t) });
    const bucket = sums.get(monthKey(t.effective_date));
    if (!bucket) continue;
    const amount = toDecimal(t.amount);
    if (t.type === "income") bucket.revenue = bucket.revenue.plus(amount);
    else if (t.scope === "personal") bucket.expPersonal = bucket.expPersonal.plus(amount);
    else bucket.expBusiness = bucket.expBusiness.plus(amount);
  }
  balanceMoves.sort((a, b) => a.date.localeCompare(b.date));

  let balance = new Decimal(opening.balance);
  let moveIndex = 0;
  let year = { revenue: ZERO, expBusiness: ZERO, expPersonal: ZERO };
  const rows: MonthRow[] = months.map((month) => {
    const end = lastDayOfMonth(month);
    while (moveIndex < balanceMoves.length && balanceMoves[moveIndex]!.date <= end) {
      balance = balance.plus(balanceMoves[moveIndex]!.amount);
      moveIndex++;
    }
    const s = sums.get(month)!;
    year = {
      revenue: year.revenue.plus(s.revenue),
      expBusiness: year.expBusiness.plus(s.expBusiness),
      expPersonal: year.expPersonal.plus(s.expPersonal),
    };
    // Lunile dinaintea datei de pornire nu au sold.
    const endBalance = end < opening.date ? new Decimal(NaN) : balance;
    return { month, ...computePnL(s.revenue, s.expBusiness, s.expPersonal, rates), endBalance };
  });

  // Taxele anuale se calculează pe totalul anului (pierderile dintr-o lună compensează profitul din alta).
  return { months: rows, year: computePnL(year.revenue, year.expBusiness, year.expPersonal, rates) };
}

/** Sold la o anumită dată (inclusiv), doar din tranzacții realizate sau și planificate. */
export function balanceAt(
  transactions: Pick<Transaction, "type" | "amount" | "status" | "effective_date">[],
  date: string,
  withPlanned: boolean,
  opening: { balance: Decimal.Value; date: string },
): Decimal {
  let balance = new Decimal(opening.balance);
  for (const t of transactions) {
    if (!includeTx(t, withPlanned) || t.effective_date < opening.date || t.effective_date > date) continue;
    balance = balance.plus(signed(t));
  }
  return balance;
}
