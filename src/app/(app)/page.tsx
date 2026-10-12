import Link from "next/link";
import Decimal from "decimal.js";
import { addDays, format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  ClapperboardIcon,
  ListTodoIcon,
  PhoneCallIcon,
  PlusIcon,
  WalletIcon,
} from "lucide-react";
import { Agenda } from "@/components/dashboard/agenda";
import { ReminderList } from "@/components/dashboard/reminder-list";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { balanceAt, lastDayOfMonth, monthKey } from "@/lib/finance/calc";
import { fetchFinanceSettings, fetchTransactions } from "@/lib/finance/queries";
import { formatDate, formatRON, todayISO, toDecimal } from "@/lib/format";
import { projectHealth, sortTasks } from "@/lib/projects/health";
import { fetchAppSettings, fetchProjectList, fetchServices } from "@/lib/projects/queries";
import { getMyReminders } from "@/lib/reminders/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function greeting(hour: number) {
  if (hour < 11) return "Bună dimineața";
  if (hour < 18) return "Bună ziua";
  return "Bună seara";
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const seesProjects = profile.role !== "setter";
  const seesLeads = profile.role !== "productie";
  const today = todayISO();

  const [reminders, money, projectsBlock] = await Promise.all([
    getMyReminders(),
    isAdmin ? moneyThisMonth(today).catch(() => null) : null,
    seesProjects ? projectsSummary(isAdmin, today).catch(() => null) : null,
  ]);

  const tomorrow = format(addDays(parseISO(today), 1), "yyyy-MM-dd");
  // „Azi” include și filmările de mâine (pregătire).
  const todo = [...reminders.today, ...reminders.upcoming.filter((r) => r.kind === "shoot" && r.date === tomorrow)];
  const upcoming = reminders.upcoming.filter((r) => !todo.includes(r));
  const firstName = profile.full_name.split(" ")[0] || "";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Bucharest" }).format(new Date()));
  const followUpsToday = reminders.today.filter((r) => r.kind === "followup").length + reminders.overdue.filter((r) => r.kind === "followup").length;
  const shootsWeek = [...reminders.today, ...reminders.upcoming].filter((r) => r.kind === "shoot").length;

  return (
    <div className="grid grid-cols-1 gap-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground first-letter:uppercase">{format(parseISO(today), "EEEE, d MMMM yyyy", { locale: ro })}</p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight">
            {greeting(hour)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {todo.length || reminders.overdue.length
              ? `Ai ${todo.length} ${todo.length === 1 ? "lucru" : "lucruri"} pentru azi${reminders.overdue.length ? ` și ${reminders.overdue.length} restante` : ""}.`
              : "Nimic urgent azi. Zi liniștită!"}
          </p>
        </div>
        <div className="hidden gap-2 sm:flex">
          {seesLeads ? (
            <Button variant="outline" asChild>
              <Link href="/leaduri?nou=1">
                <PlusIcon /> Lead
              </Link>
            </Button>
          ) : null}
          {seesProjects ? (
            <Button asChild>
              <Link href="/proiecte/nou">
                <PlusIcon /> Proiect
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ListTodoIcon} label="De făcut azi" value={String(todo.length)} hint={todo.length ? "vezi agenda" : "nimic programat"} />
        <StatCard
          icon={AlertTriangleIcon}
          label="Restante"
          value={String(reminders.overdue.length)}
          tone={reminders.overdue.length ? "bad" : "good"}
          hint={reminders.overdue.length ? "de rezolvat" : "totul la zi"}
        />
        {seesLeads ? (
          <StatCard icon={PhoneCallIcon} label="Follow-up-uri" value={String(followUpsToday)} hint="azi și restante" href="/leaduri?follow=due" />
        ) : (
          <StatCard icon={ClapperboardIcon} label="Filmări" value={String(shootsWeek)} hint="în următoarele 3 zile" href="/calendar" />
        )}
        {money ? (
          <StatCard icon={WalletIcon} label="Sold curent" value={formatRON(money.balance)} hint={`încasat luna asta ${formatRON(money.received)}`} href="/financiar" accent />
        ) : (
          <StatCard icon={ClapperboardIcon} label="Proiecte active" value={String(projectsBlock?.active ?? 0)} hint="în lucru" href="/proiecte" />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Agenda
          today={todo}
          overdue={reminders.overdue}
          upcoming={upcoming}
          render={{
            today: <ReminderList items={todo} today={today} empty="" limit={30} />,
            overdue: <ReminderList items={[...reminders.overdue].reverse()} today={today} empty="" limit={30} />,
            upcoming: <ReminderList items={upcoming} today={today} empty="" limit={30} />,
          }}
        />

        <div className="grid min-w-0 grid-cols-1 content-start gap-6">
          {money ? (
            <Panel title="Bani luna asta" subtitle={format(parseISO(today), "LLLL yyyy", { locale: ro })} href="/financiar">
              <div className="grid gap-3">
                <MoneyRow label="Încasat" value={money.received} tone="good" />
                <MoneyRow label="Cheltuit" value={money.spent} />
                <div className="border-t pt-3">
                  <MoneyRow label="Profit realizat" value={money.profit} strong />
                </div>
                <div className="rounded-lg bg-muted/60 p-3">
                  <div className="mb-2 flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">De încasat până la final de lună</span>
                    <span className="font-semibold tabular-nums">{formatRON(money.toReceive)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(100, money.received.plus(money.toReceive).isZero() ? 0 : money.received.div(money.received.plus(money.toReceive)).times(100).toNumber())}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted-foreground">
                    {money.overdueIncome ? <span className="text-destructive">{money.overdueIncome} încasări restante · </span> : null}
                    încasat din total estimat
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}

          {projectsBlock ? (
            <Panel title="Proiecte" subtitle={`${projectsBlock.active} active`} href="/proiecte">
              <div className="grid gap-3.5">
                {projectsBlock.inProgress.map((p) => (
                  <Link key={p.id} href={`/proiecte/${p.id}`} className="group grid gap-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium group-hover:underline">{p.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {p.done}/{p.total}
                      </span>
                    </div>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
                    </span>
                    {p.next ? (
                      <span className="truncate text-xs text-muted-foreground">
                        Acum: <span className="text-foreground">{p.next}</span>
                      </span>
                    ) : null}
                  </Link>
                ))}
                {projectsBlock.active > projectsBlock.inProgress.length ? (
                  <Link href="/proiecte" className="text-xs text-muted-foreground hover:text-foreground">
                    + încă {projectsBlock.active - projectsBlock.inProgress.length}
                  </Link>
                ) : null}
                {projectsBlock.active === 0 ? <p className="text-sm text-muted-foreground">Niciun proiect activ.</p> : null}
              </div>
              {projectsBlock.late.length ? (
                <div className="mt-4 grid gap-1.5">
                  {projectsBlock.late.slice(0, 4).map((p) => (
                    <Link
                      key={p.id}
                      href={`/proiecte/${p.id}`}
                      className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-danger-soft px-3 py-2 text-sm"
                    >
                      <AlertTriangleIcon className="size-3.5 shrink-0 text-destructive" />
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs text-destructive">{p.reason}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {projectsBlock.upcoming.length ? (
                <div className="mt-4 border-t pt-3">
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">Următoarele deadline-uri</div>
                  {projectsBlock.upcoming.map((p) => (
                    <Link key={p.id} href={`/proiecte/${p.id}`} className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
                      <CalendarClockIcon className={cn("size-3.5 shrink-0", p.soon ? "text-warning" : "text-muted-foreground")} />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className={cn("shrink-0 text-xs tabular-nums", p.soon ? "font-medium text-warning" : "text-muted-foreground")}>{formatDate(p.deadline)}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </Panel>
          ) : null}
        </div>
      </div>
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
  const [data, services, settings] = await Promise.all([fetchProjectList(isAdmin), fetchServices(), fetchAppSettings()]);
  if (!data || !services) return null;
  const rows = data.projects
    .filter((p) => !p.archived)
    .map((p) => ({
      project: p,
      health: projectHealth(
        p,
        sortTasks(
          data.tasks.filter((t) => t.project_id === p.id),
          services,
        ),
        today,
        settings.deadline_warning_days,
      ),
    }));
  const active = rows
    .filter((r) => !r.health.delivered)
    .sort((a, b) => (a.project.deadline ?? "9999").localeCompare(b.project.deadline ?? "9999"));
  return {
    active: active.length,
    inProgress: active.slice(0, 5).map((r) => ({
      id: r.project.id,
      name: r.project.client_name,
      done: r.health.done,
      total: r.health.total,
      next: r.health.next?.title ?? null,
    })),
    late: active
      .filter((r) => r.health.level === "red")
      .map((r) => ({
        id: r.project.id,
        name: r.project.client_name,
        reason: r.health.deadlinePassed
          ? "deadline depășit"
          : r.health.overdueTasks.length === 1
            ? "1 pas întârziat"
            : `${r.health.overdueTasks.length} pași întârziați`,
      })),
    upcoming: active
      .filter((r) => r.project.deadline && r.project.deadline >= today)
      .slice(0, 5)
      .map((r) => ({ id: r.project.id, name: r.project.client_name, deadline: r.project.deadline!, soon: r.health.deadlineSoon })),
  };
}

function Panel({ title, subtitle, href, children }: { title: string; subtitle?: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="surface min-w-0 p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground first-letter:uppercase">{subtitle}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            Deschide <ArrowRightIcon className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MoneyRow({ label, value, tone, strong }: { label: string; value: Decimal; tone?: "good"; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn("text-sm", strong ? "font-medium" : "text-muted-foreground")}>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-lg font-semibold" : "font-medium",
          tone === "good" && "text-success",
          value.isNegative() && "text-destructive",
        )}
      >
        {formatRON(value)}
      </span>
    </div>
  );
}
