import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { fetchShoots, fetchStages } from "@/lib/projects/queries";
import { ACTOR_COLUMNS, type Actor } from "@/lib/projects/types";
import { createClient } from "@/lib/supabase/server";
import { ActorDetail, type ActorProject } from "./actor-detail";

export const metadata = { title: "Actor" };

export default async function ActorPage({ params }: PageProps<"/actori/[id]">) {
  const profile = await requireProfile();
  if (profile.role === "setter") redirect("/");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: actor } = await supabase.from("actors").select(ACTOR_COLUMNS).eq("id", id).maybeSingle<Actor>();
  if (!actor) notFound();

  const [{ data: projects }, shoots, stages] = await Promise.all([
    supabase
      .from("project_actors")
      .select(
        "id, role_notes, agreed_fee, project:projects(id, client_name, description, start_date, deadline, current_stage_id, archived)",
      )
      .eq("actor_id", id)
      .order("created_at", { ascending: false })
      .returns<ActorProject[]>(),
    fetchShoots({ actorId: id }),
    fetchStages(),
  ]);

  return <ActorDetail actor={actor} projects={projects ?? []} shoots={shoots} stages={stages} today={todayISO()} />;
}
