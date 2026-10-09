import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { buildDailyEmail } from "@/lib/notifications/email";
import { collectReminders, kindsForPrefs } from "@/lib/reminders/collect";
import { createClient } from "@/lib/supabase/server";
import type { NotificationPrefs } from "@/lib/types";

/** Previzualizarea emailului zilnic, cu datele de azi ale utilizatorului curent. */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  const supabase = await createClient();
  const { data: prefs } = await supabase.from("notification_prefs").select("*").eq("user_id", profile.id).maybeSingle<NotificationPrefs>();
  const today = todayISO();
  const buckets = await collectReminders(supabase, { today, horizonDays: 3, kinds: kindsForPrefs(profile.role, prefs) });
  const { html } = buildDailyEmail(profile.full_name.split(" ")[0] ?? "", today, buckets);
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
