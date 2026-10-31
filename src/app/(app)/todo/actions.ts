"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, invalid, ok, type Result } from "@/lib/action-result";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { TODO_COLUMNS, type PersonalTask } from "@/lib/todo/types";
import { timeInput } from "@/lib/validation";

const date = z.iso.date("Dată invalidă").nullable();
const title = z.string().trim().min(1, "Scrie ce ai de făcut").max(300);
const notes = z
  .string()
  .max(5000)
  .nullable()
  .transform((v) => (v?.trim() ? v.trim() : null));

function done<T>(data: T): Result<T> {
  revalidatePath("/todo");
  revalidatePath("/calendar");
  revalidatePath("/", "layout");
  return ok(data);
}

export async function createTodo(values: {
  title: string;
  due_date: string | null;
  due_time: string | null;
  notes?: string | null;
}): Promise<Result<PersonalTask>> {
  await requireProfile();
  const parsed = z.object({ title, due_date: date, due_time: timeInput.nullable(), notes: notes.optional() }).safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase.from("personal_tasks").insert(parsed.data).select(TODO_COLUMNS).single<PersonalTask>();
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01")
      return { ok: false, error: "Rulează în Supabase migrația 20261031000010_personal_tasks.sql." };
    return fail(error);
  }
  return done(data);
}

const patchSchema = z
  .object({
    title,
    notes,
    due_date: date,
    due_time: timeInput.nullable(),
    done: z.boolean(),
    /** Data la care s-a făcut (ex. bifezi azi ce ai făcut ieri). */
    done_at: z.iso.date("Dată invalidă"),
  })
  .partial();

export async function updateTodo(id: string, patch: z.input<typeof patchSchema>): Promise<Result<PersonalTask>> {
  await requireProfile();
  const parsedId = z.uuid().safeParse(id);
  const parsed = patchSchema.safeParse(patch);
  if (!parsedId.success) return invalid(parsedId.error.issues);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { done: isDone, ...rest } = parsed.data;
  const update = { ...rest, ...(isDone === undefined ? {} : { done_at: isDone ? (rest.done_at ?? todayISO()) : null }) };
  if (update.done_at && update.done_at > todayISO()) return { ok: false, error: "Data la care s-a făcut nu poate fi în viitor." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("personal_tasks")
    .update(update)
    .eq("id", parsedId.data)
    .select(TODO_COLUMNS)
    .single<PersonalTask>();
  if (error) return fail(error);
  return done(data);
}

export async function deleteTodo(id: string): Promise<Result> {
  await requireProfile();
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return invalid(parsedId.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.from("personal_tasks").delete().eq("id", parsedId.data);
  if (error) return fail(error);
  return done(null);
}
