import { MigrationNeeded } from "@/components/layout/migration-needed";
import { fetchServices } from "@/lib/projects/queries";
import { createClient } from "@/lib/supabase/server";
import type { CostType, ExpenseCategory } from "@/lib/types";
import { ListEditor } from "../list-editor";
import { SettingsSection } from "../section";

export const metadata = { title: "Setări proiecte" };

export default async function ProjectSettingsPage() {
  const supabase = await createClient();
  const [services, { data: costTypes }, { data: categories }] = await Promise.all([
    fetchServices(),
    supabase.from("cost_types").select("*").order("sort_order").returns<CostType[]>(),
    supabase.from("expense_categories").select("*").order("sort_order").returns<ExpenseCategory[]>(),
  ]);

  if (!services) return <MigrationNeeded title="Setări proiecte" file="20261014000006_services.sql" />;

  return (
    <>
      <SettingsSection
        title="Servicii"
        description="Ce vinzi. Pe fiecare proiect bifezi unul sau mai multe servicii, iar proiectul primește pașii lor."
      >
        <ListEditor
          table="services"
          rows={services}
          addPlaceholder="Serviciu nou (ex. Statice, Website)"
          fields={[
            { key: "color", label: "Culoare", type: "color" },
            { key: "active", label: "Activ", type: "bool", hint: "Serviciile inactive nu mai apar la proiectele noi." },
          ]}
        />
      </SettingsSection>

      {services.map((service) => (
        <SettingsSection
          key={service.id}
          title={`Pași: ${service.name}`}
          description="Checklist-ul pe care îl primește un proiect nou cu acest serviciu. „Zile de la start” dă termenul sugerat. Modificările de aici nu schimbă proiectele existente."
        >
          <ListEditor
            table="service_steps"
            rows={service.steps}
            addPlaceholder="Pas nou"
            createValues={{ service_id: service.id }}
            fields={[{ key: "default_offset_days", label: "Zile de la start", type: "number", placeholder: "—", suffix: "zile" }]}
          />
        </SettingsSection>
      ))}

      <SettingsSection
        title="Tipuri de cost"
        description="Liniile de cost de pe proiecte. Categoria aleasă e cea în care costul apare în cashflow."
      >
        <ListEditor
          table="cost_types"
          rows={costTypes ?? []}
          addPlaceholder="Tip de cost nou"
          locked={Object.fromEntries(
            (costTypes ?? []).filter((t) => t.is_commission).map((t) => [t.id, "Folosit pentru comisionul calculat automat"]),
          )}
          fields={[
            {
              key: "default_category_id",
              label: "Categorie cashflow",
              type: "select",
              placeholder: "Fără categorie",
              options: (categories ?? []).map((c) => ({ value: c.id, label: c.name })),
            },
            { key: "active", label: "Activ", type: "bool" },
          ]}
        />
      </SettingsSection>
    </>
  );
}
