"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string };

const schema = z.object({
  email: z.email("Email invalid"),
  password: z.string().min(1, "Introdu parola"),
  next: z.string().optional(),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return {
      error: error.message === "Invalid login credentials" ? "Email sau parolă greșită" : error.message,
      email,
    };
  }

  // Acceptăm doar căi interne, ca să nu putem fi redirecționați în afara aplicației.
  const next = parsed.data.next;
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
