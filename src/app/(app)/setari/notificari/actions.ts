"use server";

import { z } from "zod";
import { fail, ok, type Result } from "@/lib/action-result";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { buildDailyEmail, sendEmail } from "@/lib/notifications/email";
import { pushConfigured, sendPushToUser } from "@/lib/notifications/push";
import { collectReminders, kindsForPrefs } from "@/lib/reminders/collect";
import { createClient } from "@/lib/supabase/server";
import type { NotificationPrefs } from "@/lib/types";

const subscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(4) }),
});

export async function savePushSubscription(subscription: unknown, userAgent: string): Promise<Result> {
  const profile = await requireProfile();
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, error: "Abonament push invalid" };
  const supabase = await createClient();
  // Același dispozitiv re-abonat: înlocuim abonamentul vechi.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: profile.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: userAgent.slice(0, 300),
  });
  return error ? fail(error) : ok(null);
}

export async function deletePushSubscription(endpoint: string): Promise<Result> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return error ? fail(error) : ok(null);
}

export async function sendTestPush(): Promise<Result<string>> {
  const profile = await requireProfile();
  if (!pushConfigured()) return { ok: false, error: "Cheile VAPID nu sunt configurate pe server." };
  const supabase = await createClient();
  const result = await sendPushToUser(supabase, profile.id, {
    title: "Ecomlab CRM",
    body: "Notificările funcționează pe acest dispozitiv.",
    url: "/setari/notificari",
    tag: "test",
  });
  if (!result.sent)
    return { ok: false, error: result.errors[0] ?? "Niciun dispozitiv abonat. Apasă întâi „Activează pe acest dispozitiv”." };
  return ok(`Trimis pe ${result.sent} ${result.sent === 1 ? "dispozitiv" : "dispozitive"}.`);
}

export async function sendTestEmail(): Promise<Result<string>> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: prefs } = await supabase.from("notification_prefs").select("*").eq("user_id", profile.id).maybeSingle<NotificationPrefs>();
  const today = todayISO();
  const buckets = await collectReminders(supabase, { today, horizonDays: 3, kinds: kindsForPrefs(profile.role, prefs) });
  const to = prefs?.email_to || profile.email;
  const email = buildDailyEmail(profile.full_name.split(" ")[0] ?? "", today, buckets);
  const result = await sendEmail({ to, ...email });
  return result.ok ? ok(`Email trimis la ${to}.`) : { ok: false, error: result.error };
}
