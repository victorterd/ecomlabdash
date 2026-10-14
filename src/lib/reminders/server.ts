import "server-only";
import { cache } from "react";
import { getCurrentProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { collectReminders, kindsForPrefs, type ReminderBuckets } from "./collect";

const EMPTY: ReminderBuckets = { overdue: [], today: [], upcoming: [] };

/** Reminderele utilizatorului curent (restante, azi, următoarele 3 zile); o singură dată per request. */
export const getMyReminders = cache(async (): Promise<ReminderBuckets> => {
  const profile = await getCurrentProfile();
  if (!profile) return EMPTY;
  const supabase = await createClient();
  return collectReminders(supabase, { today: todayISO(), horizonDays: 3, kinds: kindsForPrefs(profile.role, null) }).catch(() => EMPTY);
});
