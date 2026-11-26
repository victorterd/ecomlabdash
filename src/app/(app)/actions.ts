"use server";

import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const themeSchema = z.enum(["light", "dark", "system"]);

export async function saveTheme(theme: string) {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) return;
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase.from("profiles").update({ theme: parsed.data }).eq("id", profile.id);
}
