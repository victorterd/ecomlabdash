import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { SettingsSection } from "../section";
import { ProfileNameForm, RoleSelect } from "./users-client";
import { ROLE_LABELS } from "@/lib/labels";

export const metadata = { title: "Utilizatori" };

export default async function UsersSettingsPage() {
  const me = await requireProfile();
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, theme")
    .order("created_at")
    .returns<Profile[]>();

  return (
    <>
      <SettingsSection title="Profilul tău">
        <ProfileNameForm defaultName={me.full_name} />
      </SettingsSection>

      <SettingsSection
        title="Utilizatori și roluri"
        description={
          <>
            Pregătit pentru colaboratori: <b>{ROLE_LABELS.setter}</b> vede doar lead-urile, <b>{ROLE_LABELS.productie}</b> doar proiecte,
            calendar și actori. Partea financiară e vizibilă doar pentru admin. Conturile noi se creează din Supabase (Authentication → Add
            user).
          </>
        }
      >
        <div className="surface divide-y">
          {(users ?? []).map((user) => (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {user.full_name || user.email}
                  {user.id === me.id ? <span className="ml-2 text-xs font-normal text-muted-foreground">(tu)</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <RoleSelect userId={user.id} role={user.role} disabled={user.id === me.id} />
            </div>
          ))}
        </div>
      </SettingsSection>
    </>
  );
}
