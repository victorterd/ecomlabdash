"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DateField } from "@/components/date-field";
import { MoneyInput } from "@/components/money-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber, formatPercent, formatRON } from "@/lib/format";
import type { ProjectMoney } from "@/lib/projects/money";
import { PROJECT_TYPE_LABEL, type Project, type ProjectFinance } from "@/lib/projects/types";
import { cn } from "@/lib/utils";
import { updateFinance } from "../actions";
import type { DetailState } from "./project-detail";

export function OverviewTab({
  state,
  setState,
  money,
  isAdmin,
  onPatch,
}: {
  state: DetailState;
  setState: React.Dispatch<React.SetStateAction<DetailState>>;
  money: ProjectMoney | null;
  isAdmin: boolean;
  onPatch: (patch: Partial<Project>) => void;
}) {
  const { project } = state;

  const textField = (key: keyof Project, label: string, props?: React.ComponentProps<typeof Input>) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`p-${key}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`p-${key}`}
        key={`${key}-${String(project[key] ?? "")}`}
        defaultValue={String(project[key] ?? "")}
        onBlur={(e) => {
          const next = e.target.value.trim() || null;
          if (next === (project[key] ?? null)) return;
          if (key === "client_name" && !next) {
            e.target.value = project.client_name;
            toast.error("Numele clientului e obligatoriu");
            return;
          }
          onPatch({ [key]: next });
        }}
        {...props}
      />
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid content-start gap-6">
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold">Client și proiect</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {textField("client_name", "Client / companie")}
            {textField("contact_name", "Persoană de contact")}
            {textField("contact_phone", "Telefon", { inputMode: "tel" })}
            {textField("contact_email", "Email", { type: "email" })}
            {textField("website", "Website")}
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Tip</Label>
              <Select value={project.type} onValueChange={(v) => onPatch({ type: v as Project["type"] })}>
                <SelectTrigger>
                  <SelectValue>{PROJECT_TYPE_LABEL[project.type]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proiect">Proiect</SelectItem>
                  <SelectItem value="retainer">Retainer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">{textField("description", "Ce s-a vândut")}</div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Dată început</Label>
              <DateField value={project.start_date} onChange={(v) => onPatch({ start_date: v })} aria-label="Dată început" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Deadline livrare</Label>
              <DateField value={project.deadline} onChange={(v) => onPatch({ deadline: v })} aria-label="Deadline" />
            </div>
          </div>
        </section>
        <section className="grid gap-1.5">
          <Label htmlFor="p-notes" className="text-sm font-semibold">
            Notițe
          </Label>
          <Textarea
            id="p-notes"
            key={`notes-${project.notes}`}
            defaultValue={project.notes ?? ""}
            rows={6}
            placeholder="Brief, preferințe client, linkuri către materiale…"
            onBlur={(e) => {
              const next = e.target.value.trim() ? e.target.value : null;
              if (next !== (project.notes ?? null)) onPatch({ notes: next });
            }}
          />
        </section>
      </div>

      {isAdmin && money ? <FinancePanel state={state} setState={setState} money={money} /> : null}
    </div>
  );
}

function FinancePanel({
  state,
  setState,
  money,
}: {
  state: DetailState;
  setState: React.Dispatch<React.SetStateAction<DetailState>>;
  money: ProjectMoney;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const finance = state.finance;
  const projectId = state.project.id;

  function save(patch: Partial<ProjectFinance>) {
    startTransition(async () => {
      const result = await updateFinance(projectId, patch);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setState((s) => ({ ...s, finance: result.data.finance, transactions: result.data.transactions }));
      router.refresh();
    });
  }

  const stat = (label: string, value: React.ReactNode, tone?: "good" | "bad") => (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", tone === "good" && "text-success", tone === "bad" && "text-destructive")}>
        {value}
      </span>
    </div>
  );

  return (
    <aside className="surface grid content-start gap-4 p-4 sm:p-5">
      <h2 className="text-sm font-semibold">Bani</h2>
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Valoare contract</Label>
        <MoneyInput
          value={finance?.contract_value ?? null}
          onCommit={(v) => save({ contract_value: v ?? "0" })}
          aria-label="Valoare contract"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
        {stat("Încasat", formatRON(money.received), "good")}
        {stat("De încasat", formatRON(money.toReceive))}
        {stat("Costuri totale", formatRON(money.costs))}
        {stat("Profit", formatRON(money.profit), money.profit.isNegative() ? "bad" : undefined)}
        {stat("Marjă", money.margin ? formatPercent(money.margin.toFixed(1)) : "—")}
        {stat("Costuri plătite", formatRON(money.costsPaid))}
      </div>
      {!money.installmentsTotal.isZero() && !money.installmentsTotal.equals(money.contractValue) ? (
        <p className="rounded-md bg-warning-soft px-2.5 py-2 text-xs text-warning">
          Tranșele însumează {formatRON(money.installmentsTotal)}, diferit de valoarea contractului.
        </p>
      ) : null}

      <div className="grid gap-2 border-t pt-4">
        <Label className="flex items-center gap-2">
          <Checkbox checked={finance?.commission_enabled ?? true} onCheckedChange={(v) => save({ commission_enabled: v === true })} />
          Comision setter
        </Label>
        <div className="flex items-center gap-2">
          <Input
            key={`pct-${finance?.setter_commission_pct}`}
            defaultValue={formatNumber(finance?.setter_commission_pct ?? "15")}
            className="w-20 text-right"
            inputMode="decimal"
            disabled={finance ? !finance.commission_enabled : false}
            aria-label="Procent comision"
            onBlur={(e) => {
              const v = e.target.value.trim().replace(",", ".");
              if (v && Number(v) !== Number(finance?.setter_commission_pct ?? 15)) save({ setter_commission_pct: v });
            }}
          />
          <span className="text-sm text-muted-foreground">% din contract</span>
        </div>
        <Input
          key={`setter-${finance?.setter_name}`}
          defaultValue={finance?.setter_name ?? ""}
          placeholder="Nume setter"
          aria-label="Nume setter"
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== (finance?.setter_name ?? null)) save({ setter_name: v });
          }}
        />
        <p className="text-xs text-muted-foreground">Apare automat ca cost planificat la data primei tranșe (tabul Costuri).</p>
      </div>

      {state.project.type === "retainer" ? (
        <div className="grid gap-2 border-t pt-4">
          <span className="text-sm font-medium">Retainer</span>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Sumă lunară</Label>
            <MoneyInput
              value={finance?.retainer_monthly_amount ?? null}
              allowEmpty
              onCommit={(v) => save({ retainer_monthly_amount: v })}
              aria-label="Sumă lunară"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">De la</Label>
              <DateField
                value={finance?.retainer_start_month ?? null}
                onChange={(v) => save({ retainer_start_month: v })}
                aria-label="De la"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Până la</Label>
              <DateField
                value={finance?.retainer_end_month ?? null}
                onChange={(v) => save({ retainer_end_month: v })}
                aria-label="Până la"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Încasările lunare le adaugi ca tranșe în tabul Încasări.</p>
        </div>
      ) : null}
    </aside>
  );
}
