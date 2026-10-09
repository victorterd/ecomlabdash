"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangleIcon, ArchiveIcon, ArrowLeftIcon, CalendarClockIcon, EllipsisIcon, PhoneCallIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { StageMenu } from "@/components/stage-menu";
import { Badge } from "@/components/ui/badge";
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
import { projectHealth } from "@/lib/projects/health";
import { projectMoney } from "@/lib/projects/money";
import type { ProjectDetailData } from "@/lib/projects/queries";
import {
  PROJECT_TYPE_LABEL,
  type Project,
  type ProjectFinance,
  type Shoot,
  type StageDeadline,
  type Transaction,
} from "@/lib/projects/types";
import type { ProjectStage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteProject, moveProject, updateProject } from "../actions";
import { ActorsTab } from "./actors-tab";
import { CostsTab, InstallmentsTab } from "./money-tabs";
import { OverviewTab } from "./overview-tab";
import { ShootsTab } from "./shoots-tab";
import { StagesTab } from "./stages-tab";
import type { ProjectOption } from "@/components/shoot-dialog";

export type DetailState = {
  project: Project;
  finance: ProjectFinance | null;
  deadlines: StageDeadline[];
  transactions: Transaction[];
  shoots: Shoot[];
};

const TABS = ["prezentare", "etape", "incasari", "costuri", "actori", "filmari"] as const;
type Tab = (typeof TABS)[number];

export function ProjectDetail({
  data,
  stages,
  today,
  warningDays,
  isAdmin,
  projectOptions,
}: {
  data: ProjectDetailData;
  stages: ProjectStage[];
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
    deadlines: data.deadlines,
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
      deadlines: data.deadlines,
      transactions: data.transactions,
      shoots: data.shoots,
    });
  }
  const initialTab = searchParams.get("tab") as Tab | null;
  const [tab, setTabState] = useState<Tab>(
    initialTab && TABS.includes(initialTab) && (isAdmin || !["incasari", "costuri"].includes(initialTab)) ? initialTab : "prezentare",
  );
  const [, startTransition] = useTransition();

  const { project } = state;
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const health = projectHealth(project, state.deadlines, stageById, today, warningDays);
  const money = isAdmin ? projectMoney(state.finance?.contract_value, state.transactions) : null;

  function setTab(next: string) {
    setTabState(next as Tab);
    const url = new URL(window.location.href);
    if (next === "prezentare") url.searchParams.delete("tab");
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
        // Data de start schimbă comisionul; termenul etapelor rămâne cum l-ai setat.
        if ("start_date" in patch) router.refresh();
      }
    });
  }

  function changeStage(stageId: string) {
    const before = state.project;
    setState((s) => ({ ...s, project: { ...s.project, current_stage_id: stageId } }));
    startTransition(async () => {
      const result = await moveProject(project.id, stageId, project.board_position);
      if (!result.ok) {
        toast.error(result.error);
        setState((s) => ({ ...s, project: before }));
        return;
      }
      setState((s) => ({ ...s, deadlines: result.data }));
      toast.success(`Stadiu: ${stageById.get(stageId)?.name}`);
    });
  }

  const tabCount = (n: number) => (n ? <span className="rounded-full bg-muted px-1.5 text-[11px] leading-5 tabular-nums">{n}</span> : null);
  const installments = state.transactions.filter((t) => t.type === "income");
  const costs = state.transactions.filter((t) => t.type === "expense");

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <Link href="/proiecte" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Proiecte
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold">{project.client_name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StageMenu stages={stages} value={project.current_stage_id} onChange={changeStage} />
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
              {health.overdueStages.length ? (
                <button
                  type="button"
                  onClick={() => setTab("etape")}
                  className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-xs text-destructive"
                >
                  <AlertTriangleIcon className="size-3.5" />
                  {health.overdueStages.length === 1 ? "1 etapă întârziată" : `${health.overdueStages.length} etape întârziate`}
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

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="prezentare">Prezentare</TabsTrigger>
            <TabsTrigger value="etape">
              Etape {health.overdueStages.length ? <span className="size-1.5 rounded-full bg-destructive" /> : null}
            </TabsTrigger>
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

        <TabsContent value="prezentare" className="mt-4">
          <OverviewTab state={state} setState={setState} money={money} isAdmin={isAdmin} onPatch={patchProject} />
        </TabsContent>
        <TabsContent value="etape" className="mt-4">
          <StagesTab
            projectId={project.id}
            stages={stages}
            currentStageId={project.current_stage_id}
            deadlines={state.deadlines}
            today={today}
            onChange={(d) => setState((s) => ({ ...s, deadlines: [...s.deadlines.filter((x) => x.stage_id !== d.stage_id), d] }))}
          />
        </TabsContent>
        {isAdmin && money ? (
          <>
            <TabsContent value="incasari" className="mt-4">
              <InstallmentsTab
                projectId={project.id}
                transactions={installments}
                money={money}
                today={today}
                onTransactions={(transactions) => setState((s) => ({ ...s, transactions }))}
              />
            </TabsContent>
            <TabsContent value="costuri" className="mt-4">
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
        <TabsContent value="actori" className="mt-4">
          <ActorsTab
            projectId={project.id}
            projectActors={data.projectActors}
            actors={data.actors}
            transactions={state.transactions}
            isAdmin={isAdmin}
            onTransactions={(transactions) => setState((s) => ({ ...s, transactions }))}
          />
        </TabsContent>
        <TabsContent value="filmari" className="mt-4">
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
