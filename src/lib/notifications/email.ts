import "server-only";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { formatRON, formatTime } from "@/lib/format";
import { KIND_LABEL, type Reminder, type ReminderBuckets } from "@/lib/reminders/collect";

export function siteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function itemRow(item: Reminder, base: string): string {
  const when = [item.time ? formatTime(item.time) : null, format(parseISO(item.date), "d MMM", { locale: ro })].filter(Boolean).join(" · ");
  const detail = [KIND_LABEL[item.kind], item.detail && item.detail !== KIND_LABEL[item.kind] ? item.detail : null]
    .filter(Boolean)
    .join(" · ");
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #eef0ee;">
      <a href="${base}${item.href}" style="color:#111111;text-decoration:none;font-weight:600;">${escape(item.title)}</a>
      <div style="color:#5f6660;font-size:13px;">${escape(detail)}</div>
    </td>
    <td style="padding:8px 0 8px 12px;border-bottom:1px solid #eef0ee;text-align:right;white-space:nowrap;font-size:13px;color:#5f6660;">
      ${item.amount ? `<div style="color:#111111;font-weight:600;">${escape(formatRON(item.amount))}</div>` : ""}${escape(when)}
    </td>
  </tr>`;
}

function section(title: string, items: Reminder[], base: string, accent: string): string {
  if (!items.length) return "";
  return `<h2 style="margin:24px 0 4px;font-size:15px;color:${accent};">${escape(title)} (${items.length})</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${items
    .slice(0, 40)
    .map((i) => itemRow(i, base))
    .join("")}</table>
  ${items.length > 40 ? `<p style="color:#5f6660;font-size:13px;">+ încă ${items.length - 40}</p>` : ""}`;
}

export function buildDailyEmail(name: string, today: string, buckets: ReminderBuckets): { subject: string; html: string; text: string } {
  const base = siteUrl();
  const dateLabel = format(parseISO(today), "EEEE, d MMMM", { locale: ro });
  const dueCount = buckets.today.length + buckets.overdue.length;
  const subject = dueCount
    ? `Ecomlab: ${buckets.today.length} de făcut azi${buckets.overdue.length ? `, ${buckets.overdue.length} restante` : ""}`
    : "Ecomlab: nimic urgent azi";

  const html = `<!doctype html><html lang="ro"><body style="margin:0;background:#f4f5f4;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;padding:24px;">
      <tr><td>
        <div style="font-size:20px;font-weight:700;color:#111111;"><span style="color:#1cdb10;">●</span> Ecomlab CRM</div>
        <p style="margin:12px 0 0;color:#111111;font-size:15px;">Bună dimineața${name ? `, ${escape(name)}` : ""}! Iată ce ai pentru <b>${escape(dateLabel)}</b>.</p>
        ${section("De făcut azi", buckets.today, base, "#111111")}
        ${section("Restante", buckets.overdue, base, "#dc2626")}
        ${section("Următoarele zile", buckets.upcoming, base, "#5f6660")}
        ${dueCount + buckets.upcoming.length === 0 ? `<p style="color:#5f6660;">Nimic programat. Zi liniștită!</p>` : ""}
        <p style="margin:28px 0 0;"><a href="${base}/" style="display:inline-block;background:#1cdb10;color:#0b2e08;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Deschide aplicația</a></p>
        <p style="margin:20px 0 0;color:#8a908b;font-size:12px;">Poți opri sau schimba emailul din Setări → Notificări.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const lines = (title: string, items: Reminder[]) =>
    items.length
      ? [
          `${title}:`,
          ...items.map((i) => `- ${i.title} (${KIND_LABEL[i.kind]}${i.amount ? `, ${formatRON(i.amount)}` : ""}, ${i.date})`),
          "",
        ]
      : [];
  const text = [
    `Ecomlab CRM — ${dateLabel}`,
    "",
    ...lines("De făcut azi", buckets.today),
    ...lines("Restante", buckets.overdue),
    ...lines("Următoarele zile", buckets.upcoming),
    `${base}/`,
  ].join("\n");

  return { subject, html, text };
}

export type SendResult = { ok: true } | { ok: false; error: string };

/** Trimite prin Resend (https://resend.com). */
export async function sendEmail(message: { to: string; subject: string; html: string; text: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "Lipsește RESEND_API_KEY" };
  const from = process.env.EMAIL_FROM ?? "Ecomlab CRM <onboarding@resend.dev>";
  try {
    const response = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    if (!response.ok) return { ok: false, error: `Resend ${response.status}: ${(await response.text()).slice(0, 300)}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Eroare de rețea" };
  }
}
