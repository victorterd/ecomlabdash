"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, invalid, ok, type Result } from "@/lib/action-result";
import { requireProfile } from "@/lib/auth";
import { ACTOR_COLUMNS, type Actor } from "@/lib/projects/types";
import { createClient } from "@/lib/supabase/server";
import { moneyInput } from "@/lib/validation";

async function requireProduction() {
  const profile = await requireProfile();
  if (profile.role === "setter") throw new Error("Nu ai acces la actori");
}

const text = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .transform((v) => v || null);

const actorSchema = z.object({
  name: z.string().trim().min(1, "Numele e obligatoriu").max(200),
  phone: text,
  email: text,
  instagram: text,
  rate: moneyInput.nullable(),
  rate_unit: z.enum(["clip", "zi", "proiect"]),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z
    .string()
    .max(10000)
    .nullable()
    .transform((v) => (v?.trim() ? v : null)),
  active: z.boolean(),
});

export async function saveActor(id: string | null, values: Record<string, unknown>): Promise<Result<Actor>> {
  await requireProduction();
  const parsed = (id ? actorSchema.partial() : actorSchema).safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const query = id ? supabase.from("actors").update(parsed.data).eq("id", id) : supabase.from("actors").insert(parsed.data);
  const { data, error } = await query.select(ACTOR_COLUMNS).single<Actor>();
  if (error) return fail(error);
  revalidatePath("/actori", "layout");
  revalidatePath("/proiecte", "layout");
  return ok(data);
}

export async function deleteActor(id: string): Promise<Result> {
  await requireProduction();
  const supabase = await createClient();
  const { count } = await supabase.from("project_actors").select("id", { count: "exact", head: true }).eq("actor_id", id);
  if (count) return { ok: false, error: "Actorul are proiecte în istoric. Marchează-l ca inactiv în loc să-l ștergi." };
  const { error } = await supabase.from("actors").delete().eq("id", id);
  if (error) return fail(error);
  revalidatePath("/actori", "layout");
  return ok(null);
}
