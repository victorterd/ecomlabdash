import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@ecomlab.ro",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Trimite notificarea pe toate dispozitivele utilizatorului.
 * Abonamentele expirate (404/410) sunt șterse.
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  if (!pushConfigured()) return { sent: 0, failed: 0, errors: ["Cheile VAPID nu sunt configurate"] };
  configure();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .returns<Subscription[]>();
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60 * 12,
          urgency: "high",
        });
        sent++;
      } catch (error) {
        failed++;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await supabase.from("push_subscriptions").delete().eq("id", s.id);
        else errors.push(error instanceof Error ? error.message : String(error));
      }
    }),
  );
  return { sent, failed, errors };
}
