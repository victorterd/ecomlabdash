import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIMEZONE } from "@/lib/format";
import { collectReminders, kindsForPrefs, KIND_LABEL, type ReminderBuckets } from "@/lib/reminders/collect";
import type { NotificationPrefs, UserRole } from "@/lib/types";
import { buildDailyEmail, sendEmail } from "./email";
import { pushConfigured, sendPushToUser } from "./push";

type UserRow = { id: string; email: string; full_name: string; role: UserRole; notification_prefs: NotificationPrefs | null };

export type TickReport = { at: string; recurringGenerated: number | null; users: { email: string; actions: string[] }[] };

/** Rezumat scurt pentru notificarea push de dimineață. */
export function pushSummary(buckets: ReminderBuckets): string {
  const counts = new Map<string, number>();
  for (const item of buckets.today) counts.set(KIND_LABEL[item.kind], (counts.get(KIND_LABEL[item.kind]) ?? 0) + 1);
  const parts = [...counts.entries()].map(([label, n]) => `${n} × ${label.toLowerCase()}`);
  if (buckets.overdue.length) parts.push(`${buckets.overdue.length} restante`);
  return parts.length ? parts.join(", ") : "Nimic programat azi.";
}

/**
 * Rulat periodic (Vercel Cron / Supabase pg_cron, la ~15 minute):
 *  - generează cheltuielile recurente planificate;
 *  - trimite emailul și push-ul de dimineață după ora din Setări (o dată pe zi);
 *  - trimite push la ora fiecărui follow-up de azi.
 * `notification_log` previne trimiterile duble.
 */
export async function runNotificationTick(supabase: SupabaseClient, now = new Date()): Promise<TickReport> {
  const local = new TZDate(now, TIMEZONE);
  const today = format(local, "yyyy-MM-dd");
  const time = format(local, "HH:mm");
  const report: TickReport = { at: `${today} ${time}`, recurringGenerated: null, users: [] };

  const { data: generated } = await supabase.rpc("generate_recurring_transactions", { p_months: 12 });
  report.recurringGenerated = typeof generated === "number" ? generated : null;

  const { data: settings } = await supabase.from("app_settings").select("daily_email_time, follow_up_default_time").single<{
    daily_email_time: string;
    follow_up_default_time: string;
  }>();
  const emailTime = (settings?.daily_email_time ?? "08:00").slice(0, 5);
  const defaultFollowUpTime = (settings?.follow_up_default_time ?? "10:00").slice(0, 5);

  const { data: users } = await supabase.from("profiles").select("id, email, full_name, role, notification_prefs(*)").returns<UserRow[]>();

  for (const user of users ?? []) {
    const prefs = user.notification_prefs;
    const actions: string[] = [];
    const { data: logRows } = await supabase
      .from("notification_log")
      .select("kind, ref_id")
      .eq("user_id", user.id)
      .eq("for_date", today)
      .returns<{ kind: string; ref_id: string | null }[]>();
    const logged = new Set((logRows ?? []).map((r) => `${r.kind}:${r.ref_id ?? ""}`));
    const log = (channel: "email" | "push", kind: string, refId: string | null = null) =>
      supabase.from("notification_log").insert({ user_id: user.id, channel, kind, ref_id: refId, for_date: today });

    const kinds = kindsForPrefs(user.role, prefs);
    const wantsEmail = prefs?.email_daily !== false;
    const wantsPush = prefs?.push_enabled !== false && pushConfigured();
    const morning = time >= emailTime;

    let buckets: ReminderBuckets | null = null;
    const getBuckets = async () => (buckets ??= await collectReminders(supabase, { today, horizonDays: 3, kinds }));

    if (morning && wantsEmail && !logged.has("daily_email:")) {
      const b = await getBuckets();
      const to = prefs?.email_to || user.email;
      const email = buildDailyEmail(user.full_name.split(" ")[0] ?? "", today, b);
      const result = await sendEmail({ to, ...email });
      if (result.ok) {
        await log("email", "daily_email");
        actions.push(`email trimis la ${to}`);
      } else actions.push(`email eșuat: ${result.error}`);
    }

    if (morning && wantsPush && !logged.has("daily_push:")) {
      const b = await getBuckets();
      if (b.today.length || b.overdue.length) {
        const result = await sendPushToUser(supabase, user.id, { title: "De făcut azi", body: pushSummary(b), url: "/", tag: "daily" });
        if (result.sent) actions.push(`push dimineață (${result.sent} dispozitive)`);
        if (result.errors.length) actions.push(`push eșuat: ${result.errors[0]}`);
      }
      await log("push", "daily_push");
    }

    // Push la ora fiecărui follow-up de azi.
    if (wantsPush && prefs?.notify_followup_at_time !== false && kinds.includes("followup")) {
      const { data: due } = await supabase
        .from("leads")
        .select("id, company_name, phone1, follow_up_time, status:lead_statuses!inner(is_closed)")
        .eq("follow_up_date", today)
        .eq("status.is_closed", false)
        .returns<{ id: string; company_name: string; phone1: string | null; follow_up_time: string | null }[]>();
      const ready = (due ?? []).filter(
        (l) => (l.follow_up_time ?? defaultFollowUpTime).slice(0, 5) <= time && !logged.has(`followup_time:${l.id}`),
      );
      for (const lead of ready.slice(0, 5)) {
        const at = (lead.follow_up_time ?? defaultFollowUpTime).slice(0, 5);
        const result = await sendPushToUser(supabase, user.id, {
          title: `Follow-up: ${lead.company_name}`,
          body: `Programat la ${at}${lead.phone1 ? ` · ${lead.phone1}` : ""}`,
          url: `/leaduri?lead=${lead.id}`,
          tag: `followup-${lead.id}`,
        });
        if (result.errors.length) actions.push(`push eșuat: ${result.errors[0]}`);
        await log("push", "followup_time", lead.id);
      }
      if (ready.length > 5) {
        await sendPushToUser(supabase, user.id, {
          title: "Follow-up-uri",
          body: `Încă ${ready.length - 5} follow-up-uri de făcut acum.`,
          url: "/leaduri?follow=today",
        });
        for (const lead of ready.slice(5)) await log("push", "followup_time", lead.id);
      }
      if (ready.length) actions.push(`push follow-up × ${ready.length}`);
    }

    report.users.push({ email: user.email, actions });
  }
  return report;
}
