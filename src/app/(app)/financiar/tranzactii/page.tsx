import { fetchCategories, fetchProjectOptionsForFinance, fetchTransactions } from "@/lib/finance/queries";
import { todayISO } from "@/lib/format";
import { TransactionsView } from "./transactions-view";

export const metadata = { title: "Tranzacții" };

export default async function TransactionsPage() {
  const [transactions, categories, projects] = await Promise.all([fetchTransactions(), fetchCategories(), fetchProjectOptionsForFinance()]);
  return <TransactionsView transactions={transactions} categories={categories} projects={projects} today={todayISO()} />;
}
