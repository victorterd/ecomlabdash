import { addDays, format, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationPrefs, UserRole } from "@/lib/types";

export type ReminderKind = "followup" | "installment" | "payment" | "shoot" | "stage" | "deadline";

export type Reminder = {
  id: string;
  kind: ReminderKind;
  date: string;
  time?: string | null;
  title: string;
  detail?: string;
  href: string;
  amount?: string;
  /** Pentru lead-uri: telefonul, ca să poți suna direct. */
  phone?: string | null;
};

export type ReminderBuckets = {
  overdue: Reminder[];
  today: Reminder[];
  /** Mâine (pentru filmări) și următoarele zile până la orizont. */
  upcoming: Reminder[];
};

export const KIND_LABEL: Record<ReminderKind, string> = {
  followup: "Follow-up",
  installment: "Încasare",
  payment: "Plată",
  shoot: "Filmare",
  stage: "Pas proiect",
  deadline: "Deadline livrare",
};

/** Ce tipuri de remindere vede fiecare rol. */
const ROLE_KINDS: Record<UserRole, ReminderKind[]> = {
  admin: ["followup", "installment", "payment", "shoot", "stage", "deadline"],
  setter: ["followup"],
  productie: ["shoot", "stage", "deadline"],
};

/** Ce tipuri sunt pornite din preferințele de notificare. */
export function kindsForPrefs(role: UserRole, prefs: Partial<NotificationPrefs> | null): ReminderKind[] {
  const on = (key: keyof NotificationPrefs) => prefs?.[key] !== false;
  return ROLE_KINDS[role].filter((kind) => {
    switch (kind) {
      case "followup":
        return on("notify_followups");
      case "installment":
        return on("notify_installments");
      case "payment":
        return on("notify_payments");
      case "shoot":
        return on("notify_shoots");
      case "stage":
      case "deadline":
        return on("notify_stage_deadlines");
    }
  });
}

type LeadRow = { id: string; company_name: string; follow_up_date: string; follow_up_time: string | null; phone1: string | null };
type TxRow = {
  id: string;
  type: "income" | "expense";
  amount: string;
  due_date: string;
  description: string | null;
  person: string | null;
  kind: string;
  project: { id: string; client_name: string } | null;
};
type ShootRow = {
  id: string;
  shoot_date: string;
  start_time: string | null;
  location: string | null;
  project: { id: string; client_name: string } | null;
  shoot_actors: { actor: { name: string } | null }[];
};
type TaskRow = {
  id: string;
  title: string;
  due_date: string;
  sort_order: number;
  service_id: string | null;
  project: { id: string; client_name: string } | null;
};
type ProjectRow = { id: string; client_name: string; deadline: string };

const TX_LABEL: Record<string, string> = {
  installment: "Tranșă",
  project_cost: "Cost proiect",
  commission: "Comision",
  recurring: "Recurent",
  manual: "",
};

/**
 * Adună tot ce e restant, de azi sau din următoarele `horizonDays` zile.
 * Funcționează și cu clientul utilizatorului (RLS) și cu clientul de service (cron).
 */
export async function collectReminders(
  supabase: SupabaseClient,
  { today, horizonDays = 3, kinds }: { today: string; horizonDays?: number; kinds: ReminderKind[] },
): Promise<ReminderBuckets> {
  const horizon = format(addDays(parseISO(today), horizonDays), "yyyy-MM-dd");
  const want = new Set(kinds);
  const items: Reminder[] = [];

  const [leads, txs, shoots, tasks, projects] = await Promise.all([
    want.has("followup")
      ? supabase
          .from("leads")
          .select("id, company_name, follow_up_date, follow_up_time, phone1, status:lead_statuses!inner(is_closed)")
          .lte("follow_up_date", horizon)
          .eq("status.is_closed", false)
          .order("follow_up_date")
          .limit(300)
          .returns<LeadRow[]>()
      : null,
    want.has("installment") || want.has("payment")
      ? supabase
          .from("transactions")
          .select("id, type, amount, due_date, description, person, kind, project:projects(id, client_name)")
          .eq("status", "planned")
          .lte("due_date", horizon)
          .order("due_date")
          .limit(300)
          .returns<TxRow[]>()
      : null,
    want.has("shoot")
      ? supabase
          .from("shoots")
          .select("id, shoot_date, start_time, location, project:projects(id, client_name), shoot_actors(actor:actors(name))")
          .gte("shoot_date", today)
          .lte("shoot_date", horizon)
          .order("shoot_date")
          .order("start_time", { nullsFirst: true })
          .returns<ShootRow[]>()
      : null,
    want.has("stage")
      ? supabase
          .from("project_tasks")
          .select("id, title, due_date, sort_order, service_id, project:projects!inner(id, client_name, archived, delivered_at)")
          .is("done_at", null)
          .lte("due_date", horizon)
          .eq("project.archived", false)
          .is("project.delivered_at", null)
          .order("sort_order")
          .limit(500)
          .returns<TaskRow[]>()
      : null,
    want.has("deadline")
      ? supabase
          .from("projects")
          .select("id, client_name, deadline")
          .eq("archived", false)
          .is("delivered_at", null)
          .lte("deadline", horizon)
          .returns<ProjectRow[]>()
      : null,
  ]);

  for (const l of leads?.data ?? []) {
    items.push({
      id: `followup-${l.id}`,
      kind: "followup",
      date: l.follow_up_date,
      time: l.follow_up_time,
      title: l.company_name,
      detail: "Follow-up",
      href: `/leaduri?lead=${l.id}`,
      phone: l.phone1,
    });
  }

  for (const t of txs?.data ?? []) {
    const kind: ReminderKind = t.type === "income" ? "installment" : "payment";
    if (!want.has(kind)) continue;
    items.push({
      id: `${kind}-${t.id}`,
      kind,
      date: t.due_date,
      title: t.project?.client_name ?? t.description ?? t.person ?? KIND_LABEL[kind],
      detail: [TX_LABEL[t.kind], t.project ? (t.description ?? t.person) : t.person].filter(Boolean).join(" · ") || undefined,
      href: "/financiar/plati",
      amount: t.amount,
    });
  }

  for (const s of shoots?.data ?? []) {
    const actors = s.shoot_actors
      .map((a) => a.actor?.name)
      .filter(Boolean)
      .join(", ");
    items.push({
      id: `shoot-${s.id}`,
      kind: "shoot",
      date: s.shoot_date,
      time: s.start_time,
      title: s.project?.client_name ?? "Filmare",
      detail: [s.location, actors].filter(Boolean).join(" · ") || undefined,
      href: s.project ? `/proiecte/${s.project.id}?tab=filmari` : "/calendar",
    });
  }

  // Câte un pas pe fiecare serviciu al proiectului: primul nebifat cu termen (ca să nu se adune toată lista).
  const nextTask = new Map<string, TaskRow>();
  for (const t of tasks?.data ?? []) {
    if (!t.project) continue;
    const key = `${t.project.id}:${t.service_id ?? ""}`;
    if (!nextTask.has(key)) nextTask.set(key, t);
  }
  for (const t of nextTask.values()) {
    items.push({
      id: `stage-${t.id}`,
      kind: "stage",
      date: t.due_date,
      title: t.project!.client_name,
      detail: t.title,
      href: `/proiecte/${t.project!.id}`,
    });
  }

  for (const p of projects?.data ?? []) {
    items.push({
      id: `deadline-${p.id}`,
      kind: "deadline",
      date: p.deadline,
      title: p.client_name,
      detail: "Deadline livrare",
      href: `/proiecte/${p.id}`,
    });
  }

  const order: Record<ReminderKind, number> = { shoot: 0, deadline: 1, stage: 2, followup: 3, installment: 4, payment: 5 };
  items.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || (a.time ?? "").localeCompare(b.time ?? ""));

  return {
    overdue: items.filter((i) => i.date < today),
    today: items.filter((i) => i.date === today),
    upcoming: items.filter((i) => i.date > today),
  };
}

export function countDue(buckets: ReminderBuckets): number {
  return buckets.overdue.length + buckets.today.length;
}
