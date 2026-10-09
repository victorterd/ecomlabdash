import Link from "next/link";
import Decimal from "decimal.js";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { balanceAt, lastDayOfMonth, monthKey, monthlyTotals, monthRange, type PnL } from "@/lib/finance/calc";
import { fetchFinanceSettings, fetchTransactions } from "@/lib/finance/queries";
import { formatDate, formatRON, todayISO, toDecimal, formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FinanceCharts } from "./finance-charts";
import { parseYearMode, YearModeBar } from "./mode-toggle";

export const metadata = { title: "Financiar" };

const ROWS: { key: keyof PnL; label: string; strong?: boolean; muted?: boolean; hint?: string }[] = [
  { key: "revenue", label: "Venituri" },
  { key: "expBusiness", label: "Cheltuieli business" },
  { key: "expPersonal", label: "Cheltuieli personale" },
  { key: "profitGeneral", label: "Profit general", strong: true, hint: "Venituri − cheltuieli business" },
  { key: "profitAccounting", label: "Profit contabil", strong: true, hint: "Profit general − cheltuieli personale" },
  { key: "profitTax", label: "Impozit pe profit", muted: true },
  { key: "profitAfterTax", label: "Profit după impozit" },
  { key: "dividendTax", label: "Impozit dividende", muted: true },
  { key: "net", label: "Net disponibil", strong: true },
];

export default async function FinanceOverviewPage({ searchParams }: PageProps<"/financiar">) {
  const today = todayISO();
  const { year, withPlanned } = parseYearMode(await searchParams, Number(today.slice(0, 4)));
  const [transactions, settings] = await Promise.all([fetchTransactions(), fetchFinanceSettings()]);

  const opening = { balance: settings.opening_balance, date: settings.opening_balance_date };
  const rates = { profitTaxPct: settings.profit_tax_pct, dividendTaxPct: settings.dividend_tax_pct };
  const months = monthRange(`${year}-01`, 12);
  const totals = monthlyTotals(transactions, months, withPlanned, rates, opening);
  const currentMonth = monthKey(today);

  // Indicatori pentru luna curentă (indiferent de anul afișat).
  const monthEnd = lastDayOfMonth(currentMonth);
  const sum = (filter: (t: (typeof transactions)[number]) => boolean) =>
    transactions.filter(filter).reduce((acc, t) => acc.plus(toDecimal(t.amount)), new Decimal(0));
  const inMonth = (d: string) => monthKey(d) === currentMonth;
  const kpi = {
    balance: balanceAt(transactions, today, false, opening),
    received: sum((t) => t.type === "income" && t.status === "realized" && inMonth(t.effective_date)),
    spent: sum((t) => t.type === "expense" && t.status === "realized" && inMonth(t.effective_date)),
    toReceive: sum((t) => t.type === "income" && t.status === "planned" && t.due_date <= monthEnd),
    toPay: sum((t) => t.type === "expense" && t.status === "planned" && t.due_date <= monthEnd),
    endOfMonth: balanceAt(transactions, monthEnd, true, opening),
  };
  const overdueIncome = transactions.filter((t) => t.type === "income" && t.status === "planned" && t.due_date < today).length;
  const overdueExpense = transactions.filter((t) => t.type === "expense" && t.status === "planned" && t.due_date < today).length;

  const chartData = totals.months.map((m) => ({
    month: m.month,
    label: format(parseISO(`${m.month}-01`), "LLL", { locale: ro }),
    revenue: m.revenue.toNumber(),
    expenses: m.expBusiness.plus(m.expPersonal).toNumber(),
    balance: m.endBalance.isNaN() ? null : m.endBalance.toNumber(),
  }));

  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Sold curent" value={formatRON(kpi.balance)} hint={`din ${formatDate(settings.opening_balance_date)}`} strong />
        <Kpi label="Încasat luna asta" value={formatRON(kpi.received)} />
        <Kpi label="Cheltuit luna asta" value={formatRON(kpi.spent)} />
        <Kpi
          label="De încasat (până la final de lună)"
          value={formatRON(kpi.toReceive)}
          hint={overdueIncome ? `${overdueIncome} restante` : undefined}
          tone={overdueIncome ? "warn" : undefined}
          href="/financiar/plati"
        />
        <Kpi
          label="De plătit (până la final de lună)"
          value={formatRON(kpi.toPay)}
          hint={overdueExpense ? `${overdueExpense} restante` : undefined}
          tone={overdueExpense ? "warn" : undefined}
          href="/financiar/plati"
        />
        <Kpi
          label="Sold estimat la final de lună"
          value={formatRON(kpi.endOfMonth)}
          tone={kpi.endOfMonth.isNegative() ? "bad" : undefined}
        />
      </section>

      <YearModeBar basePath="/financiar" year={year} withPlanned={withPlanned} />

      <section className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr className="[&>th]:h-9 [&>th]:px-3 [&>th]:text-right [&>th]:font-medium [&>th]:whitespace-nowrap">
                <th className="sticky left-0 z-10 bg-muted text-left!">{withPlanned ? "Realizat + planificat" : "Realizat"}</th>
                {totals.months.map((m) => (
                  <th key={m.month} className={cn("capitalize", m.month === currentMonth && "bg-accent text-accent-foreground")}>
                    {format(parseISO(`${m.month}-01`), "LLL", { locale: ro })}
                  </th>
                ))}
                <th className="border-l">Total {year}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr
                  key={row.key}
                  className={cn(
                    "border-t [&>td]:px-3 [&>td]:py-1.5 [&>td]:text-right [&>td]:whitespace-nowrap [&>td]:tabular-nums",
                    row.strong && "font-semibold",
                  )}
                >
                  <td className="sticky left-0 z-10 bg-background text-left! font-medium" title={row.hint}>
                    {row.label}
                  </td>
                  {totals.months.map((m) => (
                    <MoneyCell key={m.month} value={m[row.key]} muted={row.muted} highlight={m.month === currentMonth} />
                  ))}
                  <MoneyCell value={totals.year[row.key]} muted={row.muted} className="border-l bg-muted/30" />
                </tr>
              ))}
              <tr className="border-t-2 font-semibold [&>td]:px-3 [&>td]:py-1.5 [&>td]:text-right [&>td]:whitespace-nowrap [&>td]:tabular-nums">
                <td className="sticky left-0 z-10 bg-background text-left!">Sold la final de lună</td>
                {totals.months.map((m) => (
                  <MoneyCell key={m.month} value={m.endBalance} highlight={m.month === currentMonth} />
                ))}
                <MoneyCell value={totals.months.at(-1)!.endBalance} className="border-l bg-muted/30" />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <p className="-mt-3 text-xs text-muted-foreground">
        Impozitele: {Number(settings.profit_tax_pct)}% pe profit și {Number(settings.dividend_tax_pct)}% pe dividende (din Setări →
        Financiar), 0 când profitul e negativ. Pe coloana „Total” se calculează pe totalul anului, deci o lună pe pierdere compensează
        profitul altor luni.
      </p>

      <FinanceCharts data={chartData} currentMonth={currentMonth} />
    </div>
  );
}

function MoneyCell({ value, muted, highlight, className }: { value: Decimal; muted?: boolean; highlight?: boolean; className?: string }) {
  if (value.isNaN()) return <td className={cn("text-muted-foreground/50", highlight && "bg-accent/40", className)}>—</td>;
  return (
    <td
      className={cn(
        value.isNegative() && "text-destructive",
        value.isZero() && "text-muted-foreground/60",
        muted && "text-muted-foreground",
        highlight && "bg-accent/40",
        className,
      )}
    >
      {value.isZero() ? "0" : formatAmount(value)}
    </td>
  );
}

function Kpi({
  label,
  value,
  hint,
  strong,
  tone,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  tone?: "warn" | "bad";
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "grid h-full content-start gap-1 rounded-xl border p-3 sm:p-4",
        strong && "border-brand/40 bg-accent/50",
        tone === "warn" && "border-warning/40 bg-warning-soft",
        tone === "bad" && "border-destructive/40 bg-danger-soft",
        href && "hover:bg-muted/50",
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-semibold tabular-nums sm:text-xl">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
