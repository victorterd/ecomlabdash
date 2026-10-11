import { createClient } from "@/lib/supabase/server";
import { SettingsSection } from "../section";
import { TestDataButtons } from "./test-data-buttons";

export const metadata = { title: "Date de test" };

export default async function TestDataPage() {
  const supabase = await createClient();
  const [{ count }, { count: projectCount }] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("is_seed", true),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_seed", true),
  ]);

  return (
    <SettingsSection
      title="Date de test"
      description="Generează date fictive ca să vezi aplicația populată. Sunt marcate cu eticheta „test” și se șterg cu un singur click, fără să atingă datele tale reale."
    >
      <div className="surface grid gap-3 p-4 sm:p-5">
        <p className="text-sm">
          Acum există <b>{count ?? 0}</b> lead-uri și <b>{projectCount ?? 0}</b> proiecte de test (cu actori, filmări, tranșe și costuri).
        </p>
        <TestDataButtons hasData={(count ?? 0) + (projectCount ?? 0) > 0} />
      </div>
    </SettingsSection>
  );
}
