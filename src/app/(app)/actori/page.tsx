import { redirect } from "next/navigation";
import { MigrationNeeded } from "@/components/layout/migration-needed";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { isMissingRelation } from "@/lib/db-errors";
import { ACTOR_COLUMNS, type Actor } from "@/lib/projects/types";
import { createClient } from "@/lib/supabase/server";
import { ActorsView } from "./actors-view";

export const metadata = { title: "Actori" };

export default async function ActorsPage() {
  const profile = await requireProfile();
  if (profile.role === "setter") redirect("/");
  const supabase = await createClient();
  const { data: actors, error } = await supabase.from("actors").select(ACTOR_COLUMNS).order("name").returns<Actor[]>();
  if (error && isMissingRelation(error)) return <MigrationNeeded title="Actori" file="20261011000003_projects.sql" />;
  if (error) throw new Error(error.message);

  const { data: links } = await supabase.from("project_actors").select("actor_id").returns<{ actor_id: string }[]>();
  const projectCounts: Record<string, number> = {};
  for (const l of links ?? []) projectCounts[l.actor_id] = (projectCounts[l.actor_id] ?? 0) + 1;

  return (
    <>
      <PageHeader title="Actori" description="Actori UGC: contact, tarif, rating intern și proiectele în care au jucat." />
      <ActorsView actors={actors} projectCounts={projectCounts} />
    </>
  );
}
