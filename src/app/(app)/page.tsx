import Link from "next/link";
import Decimal from "decimal.js";
import { addDays, format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { AlertTriangleIcon, ArrowRightIcon } from "lucide-react";
import { ReminderList } from "@/components/dashboard/reminder-list";
import { ColorBadge } from "@/components/ui/badge";
import { requireProfile } from "@/lib/auth";
import { balanceAt, lastDayOfMonth, monthKey } from "@/lib/finance/calc";
import { fetchFinanceSettings, fetchTransactions } from "@/lib/finance/queries";
import { formatDate, formatRON, todayISO, toDecimal } from "@/lib/format";
import { projectHealth } from "@/lib/projects/health";
import { fetchAppSettings, fetchProjectList, fetchStages } from "@/lib/projects/queries";
import { getMyReminders } from "@/lib/reminders/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const seesProjects = profile.role !== "setter";
  const today = todayISO();

  const [reminders, money, projectsBlock] = await Promise.all([
    getMyReminders(),
    isAdmin ? moneyThisMonth(today).catch(() => null) : null,
    seesProjects ? projectsSummary(isAdmin, today).catch(() => null) : null,
  ]);

  const tomorrow = format(addDays(parseISO(today), 1), "yyyy-MM-dd");
  // „De făcut azi”: tot ce e azi + filmările de mâine (pregătire).
  const todo = [...reminders.today, ...reminders.upcoming.filter((r) => r.kind === "shoot" && r.date === tomorrow)];
  const firstName = profile.full_name.split(" ")[0] || "";

  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Salut{firstName ? `, ${firstName}` : ""}!</h1>
        <p className="mt-1 text-sm text-muted-foreground capitalize">{format(parseISO(today), "EEEE, d MMMM yyyy", { locale: ro })}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="De făcut azi" count={todo.length}>
          <ReminderList items={todo} today={today} empty="Nimic programat pentru azi." limit={10} />
        </Panel>
        <Panel title="Remindere" subtitle="Restante și următoarele 3 zile" count={reminders.overdue.length} countTone="bad">
          {reminders.overdue.length ? (
            <div className="mb-2">
              <div className="mb-1 flex items-center gap-1.5 px-1 text-xs font-medium text-destructive">
                <AlertTriangleIcon className="size-3.5" /> Restante · {reminders.overdue.length}
              </div>
              <ReminderList items={[...reminders.overdue].reverse()} today={today} empty="" limit={6} />
            </div>
          ) : null}
          <div className="mb-1 px-1 text-xs font-medium text-muted-foreground">Următoarele 3 zile</div>
          <ReminderList items={reminders.upcoming} today={today} empty="Nimic în următoarele 3 zile." limit={8} />
        </Panel>
      </div>

      {money ? (
        <Panel title="Bani luna asta" subtitle={format(parseISO(today), "LLLL yyyy", { locale: ro })} href="/financiar">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Încasat" value={formatRON(money.received)} tone="good" />
            <Stat label="Cheltuit" value={formatRON(money.spent)} />
            <Stat label="Profit (realizat)" value={formatRON(money.profit)} tone={money.profit.isNegative() ? "bad" : undefined} />
            <Stat
              label="De încasat"
              value={formatRON(money.toReceive)}
              hint={money.overdueIncome ? `${money.overdueIncome} restante` : "până la final de lună"}
            />
            <Stat label="Sold curent" value={formatRON(money.balance)} strong />
          </div>
        </Panel>
      ) : null}

      {projectsBlock ? (
        <Panel title="Proiecte și termene" href="/proiecte" count={projectsBlock.active} countLabel="active">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="grid min-w-0 grid-cols-1 content-start gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">Pe stadii</h3>
              {projectsBlock.byStage.map((s) => (
                <Link key={s.id} href="/proiecte" className="flex items-center gap-2 text-sm">
                  <span className="w-36 truncate">
                    <ColorBadge color={s.color}>{s.name}</ColorBadge>
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(s.count / projectsBlock.maxStage) * 100}%`, backgroundColor: s.color }}
                    />
                  </span>
                  <span className="w-6 text-right tabular-nums">{s.count}</span>
                </Link>
              ))}
              {projectsBlock.active === 0 ? <p className="text-sm text-muted-foreground">Niciun proiect activ.</p> : null}
            </div>
            <div className="grid min-w-0 grid-cols-1 content-start gap-4">
              {projectsBlock.late.length ? (
                <div className="grid gap-1.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <AlertTriangleIcon className="size-3.5" /> Întârziate · {projectsBlock.late.length}
                  </h3>
                  {projectsBlock.late.slice(0, 5).map((p) => (
                    <Link
                      key={p.id}
                      href={`/proiecte/${p.id}?tab=etape`}
                      className="flex items-center justify-between gap-2 rounded-md bg-danger-soft px-2.5 py-1.5 text-sm"
                    >
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs text-destructive">{p.reason}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <h3 className="text-xs font-medium text-muted-foreground">Următoarele deadline-uri</h3>
                {projectsBlock.upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Niciun deadline programat.</p> : null}
                {projectsBlock.upcoming.map((p) => (
                  <Link
                    key={p.id}
                    href={`/proiecte/${p.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className={cn("shrink-0 text-xs tabular-nums", p.soon ? "font-medium text-warning" : "text-muted-foreground")}>
                      {formatDate(p.deadline)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

async function moneyThisMonth(today: string) {
  const [transactions, settings] = await Promise.all([fetchTransactions(), fetchFinanceSettings()]);
  const month = monthKey(today);
  const monthEnd = lastDayOfMonth(month);
  const sum = (filter: (t: (typeof transactions)[number]) => boolean) =>
    transactions.filter(filter).reduce((acc, t) => acc.plus(toDecimal(t.amount)), new Decimal(0));
  const received = sum((t) => t.type === "income" && t.status === "realized" && t.effective_date.startsWith(month));
  const spent = sum((t) => t.type === "expense" && t.status === "realized" && t.effective_date.startsWith(month));
  return {
    received,
    spent,
    profit: received.minus(spent),
    toReceive: sum((t) => t.type === "income" && t.status === "planned" && t.due_date <= monthEnd),
    overdueIncome: transactions.filter((t) => t.type === "income" && t.status === "planned" && t.due_date < today).length,
    balance: balanceAt(transactions, today, false, { balance: settings.opening_balance, date: settings.opening_balance_date }),
  };
}

async function projectsSummary(isAdmin: boolean, today: string) {
  const [data, stages, settings] = await Promise.all([fetchProjectList(isAdmin), fetchStages(), fetchAppSettings()]);
  if (!data) return null;
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const active = data.projects.filter((p) => !p.archived);
  const rows = active.map((p) => ({
    project: p,
    health: projectHealth(
      p,
      data.deadlines.filter((d) => d.project_id === p.id),
      stageById,
      today,
      settings.deadline_warning_days,
    ),
  }));
  const byStage = stages
    .filter((s) => !s.is_final)
    .map((s) => ({ id: s.id, name: s.name, color: s.color, count: active.filter((p) => p.current_stage_id === s.id).length }));
  return {
    active: rows.filter((r) => !r.health.delivered).length,
    byStage,
    maxStage: Math.max(1, ...byStage.map((s) => s.count)),
    late: rows
      .filter((r) => r.health.level === "red")
      .map((r) => ({
        id: r.project.id,
        name: r.project.client_name,
        reason: r.health.deadlinePassed
          ? "deadline depășit"
          : r.health.overdueStages.length === 1
            ? `etapă întârziată`
            : `${r.health.overdueStages.length} etape întârziate`,
      })),
    upcoming: rows
      .filter((r) => !r.health.delivered && r.project.deadline && r.project.deadline >= today)
      .sort((a, b) => a.project.deadline!.localeCompare(b.project.deadline!))
      .slice(0, 5)
      .map((r) => ({ id: r.project.id, name: r.project.client_name, deadline: r.project.deadline!, soon: r.health.deadlineSoon })),
  };
}

function Panel({
  title,
  subtitle,
  count,
  countTone,
  countLabel,
  href,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  countTone?: "bad";
  countLabel?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid min-w-0 grid-cols-1 content-start gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {title}
            {count ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] leading-5 font-semibold tabular-nums",
                  countTone === "bad" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
                {countLabel ? ` ${countLabel}` : ""}
              </span>
            ) : null}
          </h2>
          {subtitle ? <p className="text-xs text-muted-foreground first-letter:uppercase">{subtitle}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Deschide <ArrowRightIcon className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
  strong?: boolean;
}) {
  return (
    <div className={cn("grid gap-0.5 rounded-lg bg-muted/50 p-3", strong && "bg-accent")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-base font-semibold tabular-nums sm:text-lg",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
