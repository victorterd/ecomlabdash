"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, invalid, ok, type Result } from "@/lib/action-result";
import { requireProfile } from "@/lib/auth";
import type { Shoot } from "@/lib/projects/types";
import { createClient } from "@/lib/supabase/server";
import { timeInput } from "@/lib/validation";

async function requireProduction() {
  const profile = await requireProfile();
  if (profile.role === "setter") throw new Error("Nu ai acces la calendar");
}

const shootSchema = z.object({
  project_id: z.uuid().nullable(),
  shoot_date: z.iso.date("Alege data filmării"),
  start_time: timeInput.nullable(),
  end_time: timeInput.nullable(),
  location: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((v) => v || null),
  notes: z
    .string()
    .max(5000)
    .nullable()
    .transform((v) => (v?.trim() ? v : null)),
  actor_ids: z.array(z.uuid()).max(50),
});

function revalidate(projectId: string | null) {
  revalidatePath("/calendar");
  revalidatePath("/actori", "layout");
  revalidatePath("/", "layout");
  if (projectId) revalidatePath(`/proiecte/${projectId}`);
}

async function setShootActors(shootId: string, actorIds: string[]) {
  const supabase = await createClient();
  await supabase.from("shoot_actors").delete().eq("shoot_id", shootId);
  if (actorIds.length) {
    const { error } = await supabase.from("shoot_actors").insert(actorIds.map((actor_id) => ({ shoot_id: shootId, actor_id })));
    if (error) throw error;
  }
}

export async function saveShoot(id: string | null, values: Record<string, unknown>): Promise<Result<Shoot>> {
  await requireProduction();
  const parsed = shootSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { actor_ids, ...fields } = parsed.data;
  const supabase = await createClient();

  const query = id ? supabase.from("shoots").update(fields).eq("id", id) : supabase.from("shoots").insert(fields);
  const { data, error } = await query
    .select("id, project_id, shoot_date, start_time, end_time, location, notes, is_seed")
    .single<Omit<Shoot, "actor_ids">>();
  if (error) return fail(error);
  try {
    await setShootActors(data.id, actor_ids);
  } catch (e) {
    return fail(e);
  }
  revalidate(data.project_id);
  return ok({ ...data, actor_ids });
}

export async function deleteShoot(id: string): Promise<Result> {
  await requireProduction();
  const supabase = await createClient();
  const { data, error } = await supabase.from("shoots").delete().eq("id", id).select("project_id").single<{ project_id: string | null }>();
  if (error) return fail(error);
  revalidate(data.project_id);
  return ok(null);
}
