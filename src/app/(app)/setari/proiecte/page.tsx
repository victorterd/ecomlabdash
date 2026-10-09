import { createClient } from "@/lib/supabase/server";
import type { CostType, ExpenseCategory, ProjectStage } from "@/lib/types";
import { ListEditor } from "../list-editor";
import { SettingsSection } from "../section";

export const metadata = { title: "Setări proiecte" };

export default async function ProjectSettingsPage() {
  const supabase = await createClient();
  const [{ data: stages }, { data: costTypes }, { data: categories }] = await Promise.all([
    supabase.from("project_stages").select("*").order("sort_order").returns<ProjectStage[]>(),
    supabase.from("cost_types").select("*").order("sort_order").returns<CostType[]>(),
    supabase.from("expense_categories").select("*").order("sort_order").returns<ExpenseCategory[]>(),
  ]);

  return (
    <>
      <SettingsSection
        title="Stadii proiect"
        description="Coloanele din Kanban, în ordinea de aici. „Zile de la start” sugerează termenul fiecărei etape la crearea unui proiect (îl poți modifica pe proiect)."
      >
        <ListEditor
          table="project_stages"
          rows={stages ?? []}
          addPlaceholder="Stadiu nou"
          fields={[
            { key: "color", label: "Culoare", type: "color" },
            { key: "default_offset_days", label: "Zile de la start", type: "number", placeholder: "—", suffix: "zile" },
            { key: "is_final", label: "Final", type: "bool", hint: "Proiectul e considerat livrat (nu mai apare ca întârziat)." },
          ]}
        />
      </SettingsSection>

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
