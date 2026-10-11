"use client";

import { useState, useTransition } from "react";
import Decimal from "decimal.js";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { toast } from "sonner";
import type { ForecastEntry } from "@/lib/finance/queries";
import { formatNumber, formatRON, parseMoneyInput, toDecimal, formatAmount } from "@/lib/format";
import type { ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveForecast } from "../actions";

export type ForecastMonth = {
  month: string;
  plannedIncome: string;
  plannedExpense: string;
  realizedIncome: string;
  realizedExpense: string;
};

const key = (month: string, type: string, categoryId: string | null) => `${month}|${type}|${categoryId ?? ""}`;

export function ForecastView({
  months,
  categories,
  entries,
  startBalance,
  currentMonth,
}: {
  months: ForecastMonth[];
  categories: ExpenseCategory[];
  entries: ForecastEntry[];
  startBalance: string;
  currentMonth: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.map((e) => [key(e.month.slice(0, 7), e.type, e.category_id), e.amount])),
  );
  const [, startTransition] = useTransition();

  function save(month: string, type: "income" | "expense", categoryId: string | null, raw: string) {
    const k = key(month, type, categoryId);
    const parsed = raw.trim() ? parseMoneyInput(raw) : "0";
    if (parsed === null) return void toast.error("Sumă invalidă");
    if (Number(parsed) === Number(values[k] ?? 0)) return;
    setValues((v) => ({ ...v, [k]: parsed }));
    startTransition(async () => {
      const result = await saveForecast(`${month}-01`, type, categoryId, parsed);
      if (!result.ok) toast.error(result.error);
    });
  }

  const value = (month: string, type: string, categoryId: string | null) => toDecimal(values[key(month, type, categoryId)] ?? 0);
  const forecastIncome = (m: string) => value(m, "income", null);
  const forecastExpense = (m: string) => categories.reduce((acc, c) => acc.plus(value(m, "expense", c.id)), new Decimal(0));

  const balances: { planned: Decimal; forecast: Decimal }[] = [];
  for (const m of months) {
    const prev = balances.at(-1) ?? { planned: toDecimal(startBalance), forecast: toDecimal(startBalance) };
    // Lunile fără estimare folosesc planificatul; forecast-ul nu coboară sub ce s-a realizat deja.
    const fInc = forecastIncome(m.month);
    const fExp = forecastExpense(m.month);
    const inc = fInc.isZero() ? toDecimal(m.plannedIncome) : Decimal.max(fInc, toDecimal(m.realizedIncome));
    const exp = fExp.isZero() ? toDecimal(m.plannedExpense) : Decimal.max(fExp, toDecimal(m.realizedExpense));
    balances.push({
      planned: prev.planned.plus(m.plannedIncome).minus(m.plannedExpense),
      forecast: prev.forecast.plus(inc).minus(exp),
    });
  }

  const label = (m: string) => format(parseISO(`${m}-01`), "LLL yy", { locale: ro });
  const th = "[&>th]:h-9 [&>th]:px-2 [&>th]:text-right [&>th]:font-medium [&>th]:whitespace-nowrap";
  const td = "[&>td]:px-2 [&>td]:py-1 [&>td]:text-right [&>td]:whitespace-nowrap [&>td]:tabular-nums";
  const money = (v: Decimal.Value) => {
    const d = toDecimal(v as string);
    return d.isZero() ? <span className="text-muted-foreground/50">—</span> : formatAmount(d);
  };

  const inputCell = (m: string, type: "income" | "expense", categoryId: string | null) => {
    const k = key(m, type, categoryId);
    const v = values[k];
    return (
      <td key={m} className={cn(m === currentMonth && "bg-accent/40")}>
        <input
          key={`${k}-${v ?? ""}`}
          defaultValue={v && Number(v) ? formatNumber(v) : ""}
          inputMode="decimal"
          placeholder="—"
          aria-label={`Forecast ${type === "income" ? "venituri" : "cheltuieli"} ${label(m)}`}
          className="h-7 w-24 rounded border border-transparent bg-transparent px-1.5 text-right text-sm outline-none hover:border-input focus:border-ring focus:bg-card"
          onBlur={(e) => save(m, type, categoryId, e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </td>
    );
  };

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <div>
          <h2 className="text-base font-semibold">Forecast pe următoarele 12 luni</h2>
          <p className="text-sm text-muted-foreground">
            Introdu cât estimezi că vei încasa și cheltui în fiecare lună. Se salvează automat.
          </p>
        </div>
        <div className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr className={th}>
                  <th className="sticky left-0 z-10 min-w-44 bg-muted text-left!">Estimare</th>
                  {months.map((m) => (
                    <th key={m.month} className={cn("capitalize", m.month === currentMonth && "bg-accent text-accent-foreground")}>
                      {label(m.month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className={cn("border-t font-medium", td)}>
                  <td className="sticky left-0 z-10 bg-card text-left!">Venituri</td>
                  {months.map((m) => inputCell(m.month, "income", null))}
                </tr>
                {categories.map((c) => (
                  <tr key={c.id} className={cn("border-t", td)}>
                    <td className="sticky left-0 z-10 bg-card text-left!">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </td>
                    {months.map((m) => inputCell(m.month, "expense", c.id))}
                  </tr>
                ))}
                <tr className={cn("border-t-2 font-semibold", td)}>
                  <td className="sticky left-0 z-10 bg-card text-left!">Total cheltuieli</td>
                  {months.map((m) => (
                    <td key={m.month}>{money(forecastExpense(m.month))}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-2">
        <div>
          <h2 className="text-base font-semibold">Forecast vs. planificat vs. realizat</h2>
          <p className="text-sm text-muted-foreground">
            Planificat = tot ce e în cashflow pentru luna respectivă (realizat + planificat: tranșe, costuri, recurente). Realizat = doar ce
            s-a încasat/plătit deja.
          </p>
        </div>
        <div className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr className={th}>
                  <th className="sticky left-0 z-10 min-w-44 bg-muted text-left!" />
                  {months.map((m) => (
                    <th key={m.month} className={cn("capitalize", m.month === currentMonth && "bg-accent text-accent-foreground")}>
                      {label(m.month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Venituri — forecast", (m: ForecastMonth) => forecastIncome(m.month), "font-medium"],
                    ["Venituri — planificat", (m: ForecastMonth) => m.plannedIncome, ""],
                    ["Venituri — realizat", (m: ForecastMonth) => m.realizedIncome, "text-muted-foreground"],
                    ["Cheltuieli — forecast", (m: ForecastMonth) => forecastExpense(m.month), "font-medium border-t-2"],
                    ["Cheltuieli — planificat", (m: ForecastMonth) => m.plannedExpense, ""],
                    ["Cheltuieli — realizat", (m: ForecastMonth) => m.realizedExpense, "text-muted-foreground"],
                  ] as const
                ).map(([name, get, cls]) => (
                  <tr key={name} className={cn("border-t", td, cls)}>
                    <td className="sticky left-0 z-10 bg-card text-left!">{name}</td>
                    {months.map((m) => (
                      <td key={m.month} className={cn(m.month === currentMonth && "bg-accent/40")}>
                        {money(get(m))}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className={cn("border-t-2 font-semibold", td)}>
                  <td className="sticky left-0 z-10 bg-card text-left!">Sold proiectat (planificat)</td>
                  {balances.map((b, i) => (
                    <td key={months[i]!.month} className={cn(b.planned.isNegative() && "text-destructive")}>
                      {formatAmount(b.planned)}
                    </td>
                  ))}
                </tr>
                <tr className={cn("border-t font-semibold", td)}>
                  <td className="sticky left-0 z-10 bg-card text-left!">Sold proiectat (forecast)</td>
                  {balances.map((b, i) => (
                    <td key={months[i]!.month} className={cn(b.forecast.isNegative() && "text-destructive")}>
                      {formatAmount(b.forecast)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Ambele solduri pornesc de la soldul real de la începutul lunii curente ({formatRON(startBalance)}). La „forecast”, o lună fără
          estimare folosește valorile planificate, iar o estimare mai mică decât ce s-a realizat deja e înlocuită cu realizatul.
        </p>
      </section>
    </div>
  );
}
