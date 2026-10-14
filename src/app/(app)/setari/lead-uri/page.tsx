import { createClient } from "@/lib/supabase/server";
import type { LeadSource, LeadStatus } from "@/lib/types";
import { ListEditor } from "../list-editor";
import { SettingsSection } from "../section";

export const metadata = { title: "Setări lead-uri" };

export default async function LeadSettingsPage() {
  const supabase = await createClient();
  const [{ data: statuses }, { data: sources }] = await Promise.all([
    supabase.from("lead_statuses").select("*").order("sort_order").returns<LeadStatus[]>(),
    supabase.from("lead_sources").select("*").order("sort_order").returns<LeadSource[]>(),
  ]);

  return (
    <>
      <SettingsSection
        title="Statusuri lead"
        description="Fiecare status devine un tab în pagina Lead-uri, în ordinea de aici. Bifele controlează automatizările, deci poți redenumi statusurile liniștit."
      >
        <ListEditor
          table="lead_statuses"
          rows={statuses ?? []}
          addPlaceholder="Status nou"
          fields={[
            { key: "color", label: "Culoare", type: "color" },
            { key: "is_default", label: "Implicit", type: "bool", hint: "Statusul primit de un lead nou (doar unul)." },
            {
              key: "is_follow_up",
              label: "Follow-up",
              type: "bool",
              hint: "Setează automat data de follow-up = azi + zilele din Setări → General.",
            },
            { key: "is_won", label: "Câștigat", type: "bool", hint: "Afișează butonul „Creează proiect” pe lead." },
            { key: "is_closed", label: "Închis", type: "bool", hint: "Lead-ul nu mai apare în remindere (ex. Nu vrea, Câștigat)." },
          ]}
        />
      </SettingsSection>

      <SettingsSection
        title="Surse lead"
        description="De unde vin lead-urile. Sursele inactive nu mai apar la adăugare, dar rămân pe lead-urile existente."
      >
        <ListEditor
          table="lead_sources"
          rows={sources ?? []}
          addPlaceholder="Sursă nouă"
          fields={[{ key: "active", label: "Activă", type: "bool" }]}
        />
      </SettingsSection>
    </>
  );
}
