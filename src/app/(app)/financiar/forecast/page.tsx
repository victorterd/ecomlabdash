import Decimal from "decimal.js";
import { MigrationNeeded } from "@/components/layout/migration-needed";
import { balanceAt, lastDayOfMonth, monthKey } from "@/lib/finance/calc";
import { fetchFinanceSettings, fetchForecastYear, fetchTransactions } from "@/lib/finance/queries";
import { todayISO, toDecimal } from "@/lib/format";
import { ForecastView, type ActualMonth } from "./forecast-view";

export const metadata = { title: "Forecast" };

export default async function ForecastPage({ searchParams }: PageProps<"/financiar/forecast">) {
  const today = todayISO();
  const currentMonth = monthKey(today);
  const params = await searchParams;
  const yearParam = Number(params.an);
  const year = Number.isInteger(yearParam) && yearParam >= 2020 && yearParam <= 2100 ? yearParam : Number(today.slice(0, 4));
  const monthParam = Number(params.luna);
  const selectedMonth =
    Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12
      ? `${year}-${String(monthParam).padStart(2, "0")}`
      : currentMonth.startsWith(String(year))
        ? currentMonth
        : `${year}-01`;

  const [forecast, transactions, settings] = await Promise.all([fetchForecastYear(year), fetchTransactions(), fetchFinanceSettings()]);
  if (!forecast) return <MigrationNeeded title="Forecast" file="20261015000007_forecast_pnl.sql" />;

  const opening = { balance: settings.opening_balance, date: settings.opening_balance_date };
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const actual: ActualMonth[] = months.map((m) => {
    const inMonth = transactions.filter((t) => t.effective_date.startsWith(m));
    const sum = (filter: (t: (typeof inMonth)[number]) => boolean) =>
      inMonth
        .filter(filter)
        .reduce((acc, t) => acc.plus(toDecimal(t.amount)), new Decimal(0))
        .toFixed(2);
    return {
      month: m,
      plannedIncome: sum((t) => t.type === "income"),
      plannedExpense: sum((t) => t.type === "expense"),
      realizedIncome: sum((t) => t.type === "income" && t.status === "realized"),
      realizedExpense: sum((t) => t.type === "expense" && t.status === "realized"),
      // Pentru lunile trecute: soldul real de la final de lună (doar după data soldului inițial).
      closingBalance:
        m < currentMonth && lastDayOfMonth(m) >= opening.date
          ? balanceAt(transactions, lastDayOfMonth(m), false, opening).toFixed(2)
          : null,
    };
  });

  // Soldul real la începutul lunii curente: de aici pornesc soldurile proiectate.
  const [y, mo] = currentMonth.split("-").map(Number) as [number, number];
  const dayBefore = new Date(Date.UTC(y, mo - 1, 0)).toISOString().slice(0, 10);
  const startBalance = balanceAt(transactions, dayBefore, false, opening).toFixed(2);

  return (
    <ForecastView
      key={year}
      year={year}
      selectedMonth={selectedMonth}
      currentMonth={currentMonth}
      projects={forecast.projects}
      fixedCosts={forecast.fixedCosts}
      actual={actual}
      startBalance={startBalance}
    />
  );
}
