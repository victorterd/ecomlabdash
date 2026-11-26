import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/format";
import type { AppSettings } from "@/lib/types";
import { saveAppSettings } from "./actions";
import { SettingsSection } from "./section";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Setări" };

export default async function GeneralSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("app_settings").select("*").single<AppSettings>();
  if (!settings) return null;

  return (
    <SettingsSection title="General" description="Reguli folosite automat în lead-uri și proiecte.">
      <SettingsForm
        action={saveAppSettings}
        fields={[
          {
            name: "follow_up_days",
            label: "Zile până la follow-up",
            type: "number",
            inputMode: "numeric",
            defaultValue: String(settings.follow_up_days),
            suffix: "zile",
            help: "Când un lead trece pe un status de follow-up, data devine azi + numărul ăsta de zile.",
          },
          {
            name: "follow_up_default_time",
            label: "Ora implicită a follow-up-ului",
            type: "time",
            defaultValue: formatTime(settings.follow_up_default_time),
            help: "Ora reminderului push dacă lead-ul nu are o oră setată. Editabilă pe fiecare lead.",
          },
          {
            name: "deadline_warning_days",
            label: "Avertizare deadline proiect",
            type: "number",
            inputMode: "numeric",
            defaultValue: String(settings.deadline_warning_days),
            suffix: "zile",
            help: "Proiectele cu deadline-ul final mai aproape de atât apar cu galben.",
          },
        ]}
      />
    </SettingsSection>
  );
}
