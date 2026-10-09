import Decimal from "decimal.js";
import { format, parseISO } from "date-fns";
import { balanceAt, monthKey, monthRange } from "@/lib/finance/calc";
import { fetchCategories, fetchFinanceSettings, fetchForecast, fetchTransactions } from "@/lib/finance/queries";
import { todayISO, toDecimal } from "@/lib/format";
import { ForecastView, type ForecastMonth } from "./forecast-view";

export const metadata = { title: "Forecast" };

export default async function ForecastPage() {
  const today = todayISO();
  const months = monthRange(monthKey(today), 12);
  const first = `${months[0]}-01`;
  const [transactions, categories, forecast, settings] = await Promise.all([
    fetchTransactions(),
    fetchCategories(),
    fetchForecast(first, `${months.at(-1)}-01`),
    fetchFinanceSettings(),
  ]);

  const opening = { balance: settings.opening_balance, date: settings.opening_balance_date };
  // Soldul real la începutul perioadei (finalul lunii trecute).
  const startBalance = balanceAt(transactions, format(parseISO(first).getTime() - 86_400_000, "yyyy-MM-dd"), false, opening);

  const data: ForecastMonth[] = months.map((m) => {
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
    };
  });

  return (
    <ForecastView
      months={data}
      categories={categories.filter((c) => c.active || forecast.some((f) => f.category_id === c.id))}
      entries={forecast}
      startBalance={startBalance.toFixed(2)}
      currentMonth={monthKey(today)}
    />
  );
}
