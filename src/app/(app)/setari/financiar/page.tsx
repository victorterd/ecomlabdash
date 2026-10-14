import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import type { ExpenseCategory, FinanceSettings } from "@/lib/types";
import { saveFinanceSettings } from "../actions";
import { ListEditor } from "../list-editor";
import { SettingsSection } from "../section";
import { SettingsForm } from "../settings-form";

export const metadata = { title: "Setări financiare" };

export default async function FinanceSettingsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: categories }] = await Promise.all([
    supabase.from("finance_settings").select("*").single<FinanceSettings>(),
    supabase.from("expense_categories").select("*").order("sort_order").returns<ExpenseCategory[]>(),
  ]);
  if (!settings) return null;

  const pct = (v: string) => formatNumber(v);

  return (
    <>
      <SettingsSection
        title="Sold de pornire"
        description="Soldul din cont la data de pornire. Soldul curent = sold pornire + încasări realizate − cheltuieli realizate de la această dată."
      >
        <SettingsForm
          action={saveFinanceSettings}
          fields={[
            {
              name: "opening_balance",
              label: "Sold de pornire",
              type: "number",
              defaultValue: formatNumber(settings.opening_balance),
              suffix: "RON",
              help: "Ex. 12.500,00",
            },
            { name: "opening_balance_date", label: "La data", type: "date", defaultValue: settings.opening_balance_date },
          ]}
        />
      </SettingsSection>

      <SettingsSection
        title="Comision și impozite"
        description="Procentul de comision se precompletează pe fiecare proiect nou și poate fi schimbat acolo."
      >
        <SettingsForm
          action={saveFinanceSettings}
          fields={[
            {
              name: "setter_commission_pct",
              label: "Comision setter implicit",
              type: "number",
              defaultValue: pct(settings.setter_commission_pct),
              suffix: "%",
            },
            { name: "profit_tax_pct", label: "Impozit pe profit", type: "number", defaultValue: pct(settings.profit_tax_pct), suffix: "%" },
            {
              name: "dividend_tax_pct",
              label: "Impozit pe dividende",
              type: "number",
              defaultValue: pct(settings.dividend_tax_pct),
              suffix: "%",
            },
          ]}
        />
      </SettingsSection>

      <SettingsSection
        title="Categorii de cheltuieli"
        description="Categoriile inactive nu mai apar la adăugare, dar rămân pe tranzacțiile existente. Poți adăuga categorii noi și direct din formularul de cheltuială."
      >
        <ListEditor
          table="expense_categories"
          rows={categories ?? []}
          addPlaceholder="Categorie nouă"
          fields={[
            { key: "color", label: "Culoare", type: "color" },
            { key: "active", label: "Activă", type: "bool" },
          ]}
        />
      </SettingsSection>
    </>
  );
}
