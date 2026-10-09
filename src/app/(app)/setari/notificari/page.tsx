import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/format";
import type { AppSettings, NotificationPrefs } from "@/lib/types";
import { saveAppSettings } from "../actions";
import { SettingsSection } from "../section";
import { SettingsForm } from "../settings-form";
import { NotificationToggles } from "./notification-toggles";
import { EmailTools, PushDevice } from "./delivery-tools";
import { pushConfigured } from "@/lib/notifications/push";

export const metadata = { title: "Notificări" };

export default async function NotificationSettingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: settings }, { data: prefs }] = await Promise.all([
    supabase.from("app_settings").select("*").single<AppSettings>(),
    supabase.from("notification_prefs").select("*").eq("user_id", profile.id).maybeSingle<NotificationPrefs>(),
  ]);
  if (!settings) return null;

  return (
    <>
      <SettingsSection
        title="Email zilnic"
        description="Rezumatul de dimineață: follow-up-uri, încasări scadente, plăți, filmări și etape cu termen."
      >
        <SettingsForm
          action={saveAppSettings}
          fields={[
            {
              name: "daily_email_time",
              label: "Ora trimiterii (ora României)",
              type: "time",
              defaultValue: formatTime(settings.daily_email_time),
              help: "Emailul pleacă la primul declanșator al cronului după ora asta (vezi README → Remindere).",
            },
          ]}
        />
      </SettingsSection>

      <SettingsSection title="Email" description="Previzualizează sau trimite-ți acum emailul de dimineață, cu datele de azi.">
        <EmailTools configured={Boolean(process.env.RESEND_API_KEY)} />
      </SettingsSection>

      <SettingsSection title="Notificări push pe telefon" description="Aceleași remindere, plus o notificare la ora fiecărui follow-up.">
        <PushDevice serverConfigured={pushConfigured()} />
      </SettingsSection>

      <SettingsSection
        title="Ce notificări primești"
        description="Se aplică emailului zilnic, notificărilor push și reminderelor din aplicație."
      >
        <NotificationToggles prefs={prefs} defaultEmail={profile.email} />
      </SettingsSection>
    </>
  );
}
