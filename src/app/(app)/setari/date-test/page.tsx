import { createClient } from "@/lib/supabase/server";
import { SettingsSection } from "../section";
import { TestDataButtons } from "./test-data-buttons";

export const metadata = { title: "Date de test" };

export default async function TestDataPage() {
  const supabase = await createClient();
  const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("is_seed", true);

  return (
    <SettingsSection
      title="Date de test"
      description="Generează date fictive ca să vezi aplicația populată. Sunt marcate cu eticheta „test” și se șterg cu un singur click, fără să atingă datele tale reale."
    >
      <div className="grid gap-3 rounded-lg border p-4">
        <p className="text-sm">
          Acum există <b>{count ?? 0}</b> lead-uri de test.
          <span className="text-muted-foreground"> Proiectele, actorii și tranzacțiile de test se adaugă în etapele următoare.</span>
        </p>
        <TestDataButtons hasData={(count ?? 0) > 0} />
      </div>
    </SettingsSection>
  );
}
