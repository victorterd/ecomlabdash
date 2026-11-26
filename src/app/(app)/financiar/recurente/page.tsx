import { fetchCategories, fetchRecurring } from "@/lib/finance/queries";
import { todayISO } from "@/lib/format";
import { RecurringView } from "./recurring-view";

export const metadata = { title: "Cheltuieli recurente" };

export default async function RecurringPage() {
  const [rules, categories] = await Promise.all([fetchRecurring(), fetchCategories()]);
  return <RecurringView rules={rules} categories={categories} today={todayISO()} />;
}
