import { addDays, format, parseISO } from "date-fns";
import { lastDayOfMonth, monthKey } from "@/lib/finance/calc";
import { fetchCategories, fetchProjectOptionsForFinance, fetchTransactions } from "@/lib/finance/queries";
import { todayISO } from "@/lib/format";
import { PaymentsView } from "./payments-view";

export const metadata = { title: "Plăți de făcut" };

export default async function PaymentsPage() {
  const today = todayISO();
  const [transactions, categories, projects] = await Promise.all([fetchTransactions(), fetchCategories(), fetchProjectOptionsForFinance()]);
  return (
    <PaymentsView
      planned={transactions.filter((t) => t.status === "planned")}
      categories={categories}
      projects={projects}
      today={today}
      weekEnd={format(addDays(parseISO(today), 7), "yyyy-MM-dd")}
      monthEnd={lastDayOfMonth(monthKey(today))}
    />
  );
}
