"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangleIcon, ArchiveIcon, ArrowLeftIcon, CalendarClockIcon, CheckCircle2Icon, EllipsisIcon, PhoneCallIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Badge, ColorBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import { projectHealth, sortTasks } from "@/lib/projects/health";
import { projectMoney } from "@/lib/projects/money";
import type { ProjectDetailData } from "@/lib/projects/queries";
import {
  PROJECT_TYPE_LABEL,
  type Project,
  type ProjectFinance,
  type Service,
  type Shoot,
  type Transaction,
} from "@/lib/projects/types";
import { cn } from "@/lib/utils";
import { deleteProject, type TasksState, updateProject } from "../actions";
import { ActorsTab } from "./actors-tab";
import { CostsTab, InstallmentsTab } from "./money-tabs";
import { OverviewTab } from "./overview-tab";
import { ShootsTab } from "./shoots-tab";
import { TasksTab } from "./tasks-tab";
import type { ProjectOption } from "@/components/shoot-dialog";

export type DetailState = {
  project: Project;
  finance: ProjectFinance | null;
  tasks: TasksState;
  transactions: Transaction[];
  shoots: Shoot[];
};

const TABS = ["pasi", "prezentare", "incasari", "costuri", "actori", "filmari"] as const;
type Tab = (typeof TABS)[number];

export function ProjectDetail({
  data,
  services,
  today,
  warningDays,
  isAdmin,
  projectOptions,
}: {
  data: ProjectDetailData;
  services: Service[];
  today: string;
  warningDays: number;
  isAdmin: boolean;
  projectOptions: ProjectOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<DetailState>({
    project: data.project,
    finance: data.finance,
    tasks: { tasks: data.tasks, serviceIds: data.serviceIds, deliveredAt: data.project.delivered_at },
    transactions: data.transactions,
    shoots: data.shoots,
  });
  // Datele noi de la server (după router.refresh) înlocuiesc starea locală.
  const [prevData, setPrevData] = useState(data);
  if (prevData !== data) {
    setPrevData(data);
    setState({
      project: data.project,
      finance: data.finance,
      tasks: { tasks: data.tasks, serviceIds: data.serviceIds, deliveredAt: data.project.delivered_at },
      transactions: data.transactions,
      shoots: data.shoots,
    });
  }
  const initialTab = searchParams.get("tab") as Tab | null;
  const [tab, setTabState] = useState<Tab>(
    initialTab && TABS.includes(initialTab) && (isAdmin || !["incasari", "costuri"].includes(initialTab)) ? initialTab : "pasi",
  );
  const [, startTransition] = useTransition();

  const { project } = state;
  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const health = projectHealth(
    { ...project, delivered_at: state.tasks.deliveredAt },
    sortTasks(state.tasks.tasks, services),
    today,
    warningDays,
  );
  const money = isAdmin ? projectMoney(state.finance?.contract_value, state.transactions) : null;

  function setTab(next: string) {
    setTabState(next as Tab);
    const url = new URL(window.location.href);
    if (next === "pasi") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  function patchProject(patch: Partial<Project>) {
    const before = state.project;
    setState((s) => ({ ...s, project: { ...s.project, ...patch } }));
    startTransition(async () => {
      const result = await updateProject(project.id, patch);
      if (!result.ok) {
        toast.error(result.error);
        setState((s) => ({ ...s, project: before }));
      } else {
        setState((s) => ({ ...s, project: result.data }));
        // Data de start schimbă comisionul; termenele pașilor rămân cum le-ai setat.
        if ("start_date" in patch) router.refresh();
      }
    });
  }

  const tabCount = (n: number) => (n ? <span className="rounded-full bg-muted px-1.5 text-[11px] leading-5 tabular-nums">{n}</span> : null);
  const installments = state.transactions.filter((t) => t.type === "income");
  const costs = state.transactions.filter((t) => t.type === "expense");

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="grid min-w-0 grid-cols-1 gap-3">
        <Link href="/proiecte" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Proiecte
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold">{project.client_name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {state.tasks.serviceIds.map((id) => {
                const service = serviceById.get(id);
                return service ? (
                  <ColorBadge key={id} color={service.color}>
                    {service.name}
                  </ColorBadge>
                ) : null;
              })}
              {health.delivered && !project.archived ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <CheckCircle2Icon className="size-3.5" /> Livrat {formatDate(state.tasks.deliveredAt)}
                </span>
              ) : health.next ? (
                <button
                  type="button"
                  onClick={() => setTab("pasi")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className="tabular-nums">
                    {health.done}/{health.total}
                  </span>
                  · Acum: <b className="font-medium text-foreground">{health.next.title}</b>
                </button>
              ) : null}
              <Badge variant="secondary">{PROJECT_TYPE_LABEL[project.type]}</Badge>
              {project.archived ? <Badge variant="outline">Arhivat</Badge> : null}
              {project.deadline ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
                    health.deadlinePassed
                      ? "bg-danger-soft text-destructive"
                      : health.deadlineSoon
                        ? "bg-warning-soft text-warning"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <CalendarClockIcon className="size-3.5" /> Deadline {formatDate(project.deadline)}
                </span>
              ) : null}
              {health.overdueTasks.length ? (
                <button
                  type="button"
                  onClick={() => setTab("pasi")}
                  className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-xs text-destructive"
                >
                  <AlertTriangleIcon className="size-3.5" />
                  {health.overdueTasks.length === 1 ? "1 pas întârziat" : `${health.overdueTasks.length} pași întârziați`}
                </button>
              ) : null}
              {project.lead_id ? (
                <Link
                  href={`/leaduri?lead=${project.lead_id}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <PhoneCallIcon className="size-3.5" /> lead
                </Link>
              ) : null}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Acțiuni proiect">
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => patchProject({ archived: !project.archived })}>
                <ArchiveIcon /> {project.archived ? "Scoate din arhivă" : "Arhivează"}
              </DropdownMenuItem>
              {isAdmin ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      if (!confirm(`Ștergi proiectul „${project.client_name}”? Se șterg și tranșele, costurile și filmările lui.`)) return;
                      startTransition(async () => {
                        const result = await deleteProject(project.id);
                        if (result.ok) {
                          toast.success("Proiect șters");
                          router.push("/proiecte");
                        } else toast.error(result.error);
                      });
                    }}
                  >
                    <Trash2Icon /> Șterge proiectul
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="pasi">
              Pași {health.total ? <span className="text-[11px] text-muted-foreground tabular-nums">{health.done}/{health.total}</span> : null}
              {health.overdueTasks.length ? <span className="size-1.5 rounded-full bg-destructive" /> : null}
            </TabsTrigger>
            <TabsTrigger value="prezentare">Prezentare</TabsTrigger>
            {isAdmin ? (
              <>
                <TabsTrigger value="incasari">Încasări {tabCount(installments.length)}</TabsTrigger>
                <TabsTrigger value="costuri">Costuri {tabCount(costs.length)}</TabsTrigger>
              </>
            ) : null}
            <TabsTrigger value="actori">Actori {tabCount(data.projectActors.length)}</TabsTrigger>
            <TabsTrigger value="filmari">Filmări {tabCount(state.shoots.length)}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="prezentare" className="mt-4 min-w-0">
          <OverviewTab state={state} setState={setState} money={money} isAdmin={isAdmin} onPatch={patchProject} />
        </TabsContent>
        <TabsContent value="pasi" className="mt-4 min-w-0">
          <TasksTab
            projectId={project.id}
            services={services}
            state={state.tasks}
            today={today}
            onState={(tasks) => setState((s) => ({ ...s, tasks }))}
          />
        </TabsContent>
        {isAdmin && money ? (
          <>
            <TabsContent value="incasari" className="mt-4 min-w-0">
              <InstallmentsTab
                projectId={project.id}
                transactions={installments}
                money={money}
                today={today}
                onTransactions={(transactions) => setState((s) => ({ ...s, transactions }))}
              />
            </TabsContent>
            <TabsContent value="costuri" className="mt-4 min-w-0">
              <CostsTab
                projectId={project.id}
                transactions={costs}
                finance={state.finance}
                money={money}
                costTypes={data.costTypes}
                today={today}
                startDate={project.start_date}
                onTransactions={(transactions) => setState((s) => ({ ...s, transactions }))}
              />
            </TabsContent>
          </>
        ) : null}
        <TabsContent value="actori" className="mt-4 min-w-0">
          <ActorsTab
            projectId={project.id}
            projectActors={data.projectActors}
            actors={data.actors}
            transactions={state.transactions}
            isAdmin={isAdmin}
            onTransactions={(transactions) => setState((s) => ({ ...s, transactions }))}
          />
        </TabsContent>
        <TabsContent value="filmari" className="mt-4 min-w-0">
          <ShootsTab
            projectId={project.id}
            shoots={state.shoots}
            actors={data.actors}
            projectActorIds={data.projectActors.map((pa) => pa.actor_id)}
            projectOptions={projectOptions}
            today={today}
            onShoots={(shoots) => setState((s) => ({ ...s, shoots }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
