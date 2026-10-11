"use client";

import { useState, useTransition } from "react";
import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/date-field";
import { MoneyInput } from "@/components/money-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRON } from "@/lib/format";
import type { ProjectMoney } from "@/lib/projects/money";
import type { ProjectFinance, Transaction, TxStatus } from "@/lib/projects/types";
import type { CostType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createProjectTransaction, deleteProjectTransaction, resetCommission, updateProjectTransaction } from "../actions";

type Patch = Record<string, unknown>;

function useTxActions(onTransactions: (t: Transaction[]) => void) {
  const [, startTransition] = useTransition();
  const run = (action: () => Promise<{ ok: true; data: Transaction[] } | { ok: false; error: string }>, success?: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onTransactions(result.data);
        if (success) toast.success(success);
      } else toast.error(result.error);
    });
  return {
    update: (id: string, patch: Patch) => run(() => updateProjectTransaction(id, patch)),
    remove: (id: string) => confirm("Ștergi linia?") && run(() => deleteProjectTransaction(id), "Șters"),
    run,
  };
}

function StatusSelect({ value, onChange, labels }: { value: TxStatus; onChange: (v: TxStatus) => void; labels: Record<TxStatus, string> }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TxStatus)}>
      <SelectTrigger size="sm" className={cn("w-32", value === "realized" && "border-success/40 bg-success/10 text-success")}>
        <SelectValue>{labels[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="planned">{labels.planned}</SelectItem>
        <SelectItem value="realized">{labels.realized}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function TextCell({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      key={value ?? ""}
      defaultValue={value ?? ""}
      placeholder={placeholder}
      className={cn("h-8", className)}
      onBlur={(e) => {
        const next = e.target.value.trim() || null;
        if (next !== (value ?? null)) onSave(next);
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

function Summary({ items }: { items: { label: string; value: string; tone?: "good" | "warn" | "bad" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className="surface px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {i.tone ? (
              <span className={cn("size-1.5 rounded-full", i.tone === "good" && "bg-success", i.tone === "warn" && "bg-warning", i.tone === "bad" && "bg-destructive")} />
            ) : null}
            {i.label}
          </div>
          <div className={cn("mt-1 truncate text-[17px] font-semibold tabular-nums", i.tone === "bad" && "text-destructive")}>{i.value}</div>
        </div>
      ))}
    </div>
  );
}

const thClass = "[&>th]:h-9 [&>th]:px-2 [&>th]:text-left [&>th]:font-medium [&>th]:whitespace-nowrap";
const tdClass = "border-t [&>td]:px-2 [&>td]:py-1.5 [&>td]:align-middle";

// ---------------------------------------------------------------------
// Încasări (tranșe)
// ---------------------------------------------------------------------

export function InstallmentsTab({
  projectId,
  transactions,
  money,
  today,
  onTransactions,
}: {
  projectId: string;
  transactions: Transaction[];
  money: ProjectMoney;
  today: string;
  onTransactions: (t: Transaction[]) => void;
}) {
  const { update, remove, run } = useTxActions(onTransactions);
  const [amount, setAmount] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(today);
  const remaining = money.contractValue.minus(money.installmentsTotal);

  return (
    <div className="grid grid-cols-1 gap-4">
      <Summary
        items={[
          { label: "Valoare contract", value: formatRON(money.contractValue) },
          { label: "Încasat", value: formatRON(money.received), tone: "good" },
          { label: "De încasat", value: formatRON(money.toReceive), tone: money.toReceive.isZero() ? undefined : "warn" },
          ...(remaining.isZero()
            ? []
            : [
                {
                  label: remaining.isPositive() ? "Neplanificat încă" : "Peste contract",
                  value: formatRON(remaining.abs()),
                  tone: "bad" as const,
                },
              ]),
        ]}
      />
      <p className="text-sm text-muted-foreground">
        Fiecare tranșă apare automat în cashflow: planificată la scadență, apoi la data încasării efective.
      </p>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr className={thClass}>
                <th>Sumă</th>
                <th>Scadență</th>
                <th>Status</th>
                <th>Încasat la</th>
                <th className="min-w-48">Descriere</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className={cn(tdClass, t.status === "planned" && t.due_date < today && "bg-danger-soft")}>
                  <td>
                    <MoneyInput
                      value={t.amount}
                      onCommit={(v) => v && update(t.id, { amount: v })}
                      className="h-8 w-40"
                      aria-label="Sumă"
                    />
                  </td>
                  <td>
                    <DateField
                      value={t.due_date}
                      clearable={false}
                      onChange={(v) => v && update(t.id, { due_date: v })}
                      className="h-8 w-40"
                      aria-label="Scadență"
                    />
                  </td>
                  <td>
                    <StatusSelect
                      value={t.status}
                      onChange={(v) => update(t.id, { status: v })}
                      labels={{ planned: "Planificat", realized: "Încasat" }}
                    />
                  </td>
                  <td>
                    {t.status === "realized" ? (
                      <DateField
                        value={t.realized_date}
                        clearable={false}
                        onChange={(v) => v && update(t.id, { realized_date: v })}
                        className="h-8 w-40"
                        aria-label="Încasat la"
                      />
                    ) : t.due_date < today ? (
                      <span className="text-xs font-medium text-destructive">scadență depășită</span>
                    ) : null}
                  </td>
                  <td>
                    <TextCell value={t.description} onSave={(v) => update(t.id, { description: v })} placeholder="ex. Avans 50%" />
                  </td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(t.id)}
                      aria-label="Șterge tranșa"
                    >
                      <Trash2Icon />
                    </Button>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nicio tranșă. Adaugă modul de plată convenit cu clientul (ex. 50% avans, 50% la livrare).
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <form
          className="flex flex-wrap items-center gap-2 border-t bg-muted/30 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!amount || !dueDate) return toast.error("Completează suma și scadența");
            const description = String(new FormData(e.currentTarget).get("description") ?? "");
            run(
              () => createProjectTransaction(projectId, "installment", { amount, due_date: dueDate, status: "planned", description }),
              "Tranșă adăugată",
            );
            setAmount(null);
            e.currentTarget.reset();
          }}
        >
          <MoneyInput
            value={amount}
            onCommit={setAmount}
            allowEmpty
            className="h-8 w-40 bg-card"
            placeholder="Sumă"
            aria-label="Sumă tranșă nouă"
          />
          <DateField value={dueDate} onChange={setDueDate} className="h-8 w-40 bg-card" aria-label="Scadență tranșă nouă" />
          <Input name="description" placeholder="Descriere (opțional)" className="h-8 max-w-56 bg-card" />
          {remaining.isPositive() && !amount ? (
            <Button type="button" variant="ghost" size="xs" onClick={() => setAmount(remaining.toFixed(2))}>
              restul: {formatRON(remaining)}
            </Button>
          ) : null}
          <Button type="submit" size="sm" variant="outline">
            <PlusIcon /> Adaugă tranșă
          </Button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Costuri
// ---------------------------------------------------------------------

const NO_TYPE = "__none__";

export function CostsTab({
  projectId,
  transactions,
  finance,
  money,
  costTypes,
  today,
  startDate,
  onTransactions,
}: {
  projectId: string;
  transactions: Transaction[];
  finance: ProjectFinance | null;
  money: ProjectMoney;
  costTypes: CostType[];
  today: string;
  startDate: string | null;
  onTransactions: (t: Transaction[]) => void;
}) {
  const { update, remove, run } = useTxActions(onTransactions);
  const typeById = new Map(costTypes.map((t) => [t.id, t]));
  const selectableTypes = costTypes.filter((t) => t.active && !t.is_commission);
  const [newType, setNewType] = useState(selectableTypes[0]?.id ?? NO_TYPE);
  const [amount, setAmount] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(startDate && startDate > today ? startDate : today);
  // Comisionul primul, apoi după dată.
  const sorted = [...transactions].sort(
    (a, b) => Number(b.kind === "commission") - Number(a.kind === "commission") || a.due_date.localeCompare(b.due_date),
  );

  return (
    <div className="grid grid-cols-1 gap-4">
      <Summary
        items={[
          { label: "Venit (contract)", value: formatRON(money.contractValue) },
          { label: "Costuri totale", value: formatRON(money.costs) },
          { label: "Plătite", value: formatRON(money.costsPaid), tone: "good" },
          { label: "De plătit", value: formatRON(money.costsPlanned), tone: money.costsPlanned.isZero() ? undefined : "warn" },
          { label: "Profit", value: formatRON(money.profit), tone: money.profit.isNegative() ? "bad" : "good" },
        ]}
      />
      <p className="text-sm text-muted-foreground">
        Costurile apar automat în cashflow ca cheltuieli business, în categoria tipului de cost.
      </p>

      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr className={thClass}>
                <th>Tip</th>
                <th>Persoană</th>
                <th>Sumă</th>
                <th>Dată</th>
                <th>Status</th>
                <th>Plătit la</th>
                <th className="min-w-40">Descriere</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const isCommission = t.kind === "commission";
                const type = t.cost_type_id ? typeById.get(t.cost_type_id) : undefined;
                return (
                  <tr key={t.id} className={cn(tdClass, isCommission && "bg-accent/40")}>
                    <td className="whitespace-nowrap">
                      {isCommission ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">Comision {finance ? `${Number(finance.setter_commission_pct)}%` : ""}</span>
                          {t.manual_override ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded bg-warning-soft px-1.5 py-0.5 text-[11px] text-warning"
                                  onClick={() => run(() => resetCommission(projectId), "Comision recalculat")}
                                >
                                  editat <RotateCcwIcon className="size-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>L-ai modificat manual. Click ca să revină la calculul automat.</TooltipContent>
                            </Tooltip>
                          ) : t.status === "planned" ? (
                            <Badge variant="secondary">automat</Badge>
                          ) : null}
                        </div>
                      ) : (
                        <Select
                          value={t.cost_type_id ?? NO_TYPE}
                          onValueChange={(v) => update(t.id, { cost_type_id: v === NO_TYPE ? null : v })}
                        >
                          <SelectTrigger size="sm" className="w-40">
                            <SelectValue>{type?.name ?? "Alt cost"}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {costTypes
                              .filter((ct) => !ct.is_commission && (ct.active || ct.id === t.cost_type_id))
                              .map((ct) => (
                                <SelectItem key={ct.id} value={ct.id}>
                                  {ct.name}
                                </SelectItem>
                              ))}
                            <SelectItem value={NO_TYPE}>Alt cost</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td>
                      <TextCell value={t.person} onSave={(v) => update(t.id, { person: v })} placeholder="Nume" className="w-36" />
                    </td>
                    <td>
                      <MoneyInput
                        value={t.amount}
                        onCommit={(v) => v && update(t.id, { amount: v })}
                        className="h-8 w-36"
                        aria-label="Sumă"
                      />
                    </td>
                    <td>
                      <DateField
                        value={t.due_date}
                        clearable={false}
                        onChange={(v) => v && update(t.id, { due_date: v })}
                        className="h-8 w-36"
                        aria-label="Dată"
                      />
                    </td>
                    <td>
                      <StatusSelect
                        value={t.status}
                        onChange={(v) => update(t.id, { status: v })}
                        labels={{ planned: "Planificat", realized: "Plătit" }}
                      />
                    </td>
                    <td>
                      {t.status === "realized" ? (
                        <DateField
                          value={t.realized_date}
                          clearable={false}
                          onChange={(v) => v && update(t.id, { realized_date: v })}
                          className="h-8 w-36"
                          aria-label="Plătit la"
                        />
                      ) : null}
                    </td>
                    <td>
                      <TextCell value={t.description} onSave={(v) => update(t.id, { description: v })} />
                    </td>
                    <td className="text-right">
                      {!isCommission ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => remove(t.id)}
                          aria-label="Șterge costul"
                        >
                          <Trash2Icon />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Niciun cost încă.{" "}
                    {finance?.commission_enabled && Number(finance.contract_value) === 0
                      ? "Comisionul apare după ce completezi valoarea contractului."
                      : ""}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <form
          className="flex flex-wrap items-center gap-2 border-t bg-muted/30 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!amount || !date) return toast.error("Completează suma și data");
            const person = String(new FormData(e.currentTarget).get("person") ?? "");
            run(
              () =>
                createProjectTransaction(projectId, "project_cost", {
                  amount,
                  due_date: date,
                  status: "planned",
                  cost_type_id: newType === NO_TYPE ? null : newType,
                  person,
                }),
              "Cost adăugat",
            );
            setAmount(null);
            e.currentTarget.reset();
          }}
        >
          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger size="sm" className="w-40 bg-card">
              <SelectValue>{typeById.get(newType)?.name ?? "Alt cost"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {selectableTypes.map((ct) => (
                <SelectItem key={ct.id} value={ct.id}>
                  {ct.name}
                </SelectItem>
              ))}
              <SelectItem value={NO_TYPE}>Alt cost</SelectItem>
            </SelectContent>
          </Select>
          <Input name="person" placeholder="Persoană" className="h-8 w-36 bg-card" />
          <MoneyInput
            value={amount}
            onCommit={setAmount}
            allowEmpty
            className="h-8 w-36 bg-card"
            placeholder="Sumă"
            aria-label="Sumă cost nou"
          />
          <DateField value={date} onChange={setDate} className="h-8 w-36 bg-card" aria-label="Dată cost nou" />
          <Button type="submit" size="sm" variant="outline">
            <PlusIcon /> Adaugă cost
          </Button>
        </form>
      </div>
    </div>
  );
}
