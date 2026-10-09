"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/date-field";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TransactionRow } from "@/lib/finance/queries";
import { todayISO } from "@/lib/format";
import type { ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createCategory, deleteTransaction, saveTransaction } from "./actions";

const NONE = "__none__";
const NEW = "__new__";

export type ProjectOption = { id: string; client_name: string; archived: boolean };

export const KIND_LABEL: Record<string, string> = {
  manual: "Manual",
  installment: "Tranșă proiect",
  project_cost: "Cost proiect",
  commission: "Comision",
  recurring: "Recurent",
};

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  defaultType = "expense",
  categories,
  projects,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionRow | null;
  defaultType?: "income" | "expense";
  categories: ExpenseCategory[];
  projects: ProjectOption[];
  onSaved?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transaction ? "Editează tranzacția" : "Tranzacție nouă"}</DialogTitle>
        </DialogHeader>
        {open ? (
          <TransactionForm
            key={transaction?.id ?? defaultType}
            transaction={transaction}
            defaultType={defaultType}
            categories={categories}
            projects={projects}
            onDone={() => {
              onOpenChange(false);
              onSaved?.();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TransactionForm({
  transaction,
  defaultType,
  categories: initialCategories,
  projects,
  onDone,
}: {
  transaction: TransactionRow | null;
  defaultType: "income" | "expense";
  categories: ExpenseCategory[];
  projects: ProjectOption[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [type, setType] = useState<"income" | "expense">(transaction?.type ?? defaultType);
  const [amount, setAmount] = useState<string | null>(transaction?.amount ?? null);
  const [date, setDate] = useState<string | null>(transaction?.due_date ?? todayISO());
  const [status, setStatus] = useState<"planned" | "realized">(transaction?.status ?? "realized");
  const [realizedDate, setRealizedDate] = useState<string | null>(transaction?.realized_date ?? null);
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? NONE);
  const [scope, setScope] = useState<"business" | "personal">(transaction?.scope ?? "business");
  const [projectId, setProjectId] = useState(transaction?.project_id ?? NONE);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fromProject = transaction && transaction.kind !== "manual" && transaction.kind !== "recurring";
  const category = categories.find((c) => c.id === categoryId);
  const project = projects.find((p) => p.id === projectId);

  function addCategory() {
    if (!newCategory?.trim()) return;
    startTransition(async () => {
      const result = await createCategory(newCategory);
      if (!result.ok) return void toast.error(result.error);
      setCategories((c) => [...c, result.data]);
      setCategoryId(result.data.id);
      setNewCategory(null);
      toast.success(`Categoria „${result.data.name}” a fost adăugată`);
    });
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await saveTransaction(transaction?.id ?? null, {
            type,
            amount: amount ?? "",
            status,
            due_date: date ?? "",
            realized_date: status === "realized" ? (realizedDate ?? date) : null,
            category_id: categoryId === NONE ? null : categoryId,
            scope,
            project_id: projectId === NONE ? null : projectId,
            description: String(data.get("description") ?? ""),
            person: String(data.get("person") ?? ""),
          });
          if (result.ok) {
            toast.success("Salvat");
            onDone();
          } else setError(result.error);
        });
      }}
    >
      {fromProject ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {KIND_LABEL[transaction.kind]} generată din proiectul {transaction.project?.client_name}. Modificările apar și pe proiect.
        </p>
      ) : null}

      <div className="inline-flex w-fit rounded-lg bg-muted p-1 text-sm">
        {(["income", "expense"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={Boolean(fromProject)}
            onClick={() => setType(t)}
            className={cn(
              "rounded-md px-3 py-1 font-medium text-muted-foreground",
              type === t && "bg-background text-foreground shadow-sm",
            )}
          >
            {t === "income" ? "Încasare" : "Cheltuială"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Sumă *</Label>
          <MoneyInput value={amount} onCommit={setAmount} allowEmpty autoFocus={!transaction} aria-label="Sumă" />
        </div>
        <div className="grid gap-1.5">
          <Label>{status === "planned" ? "Dată planificată *" : "Data *"}</Label>
          <DateField value={date} onChange={setDate} clearable={false} aria-label="Data" />
        </div>
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as "planned" | "realized")}>
            <SelectTrigger>
              <SelectValue>{status === "realized" ? (type === "income" ? "Încasat" : "Plătit") : "Planificat"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="realized">{type === "income" ? "Încasat" : "Plătit"} (realizat)</SelectItem>
              <SelectItem value="planned">Planificat</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {status === "realized" && transaction?.status === "planned" ? (
          <div className="grid gap-1.5">
            <Label>Realizat la</Label>
            <DateField value={realizedDate ?? todayISO()} onChange={setRealizedDate} clearable={false} aria-label="Realizat la" />
          </div>
        ) : status === "realized" && transaction?.realized_date && transaction.realized_date !== transaction.due_date ? (
          <div className="grid gap-1.5">
            <Label>Realizat la</Label>
            <DateField value={realizedDate} onChange={setRealizedDate} clearable={false} aria-label="Realizat la" />
          </div>
        ) : null}
      </div>

      {type === "expense" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Categorie *</Label>
            {newCategory !== null ? (
              <div className="flex gap-1">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nume categorie"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCategory();
                    }
                    if (e.key === "Escape") setNewCategory(null);
                  }}
                />
                <Button type="button" size="icon" variant="outline" onClick={addCategory} aria-label="Adaugă categoria">
                  <PlusIcon />
                </Button>
              </div>
            ) : (
              <Select value={categoryId} onValueChange={(v) => (v === NEW ? setNewCategory("") : setCategoryId(v))}>
                <SelectTrigger>
                  <SelectValue>{category?.name ?? "Alege…"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c.active || c.id === categoryId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </SelectItem>
                    ))}
                  <SelectItem value={NEW}>
                    <PlusIcon className="size-3.5" /> Categorie nouă…
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>Business / Personal</Label>
            <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
              {(["business", "personal"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 font-medium text-muted-foreground",
                    scope === s && "bg-background text-foreground shadow-sm",
                  )}
                >
                  {s === "business" ? "Business" : "Personal"}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Proiect (opțional)</Label>
          <Select value={projectId} onValueChange={setProjectId} disabled={Boolean(fromProject)}>
            <SelectTrigger>
              <SelectValue>{project?.client_name ?? "Fără proiect"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Fără proiect</SelectItem>
              {projects
                .filter((p) => !p.archived || p.id === projectId)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.client_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tx-person">{type === "income" ? "De la" : "Către"}</Label>
          <Input id="tx-person" name="person" defaultValue={transaction?.person ?? ""} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tx-description">Descriere</Label>
        <Input
          id="tx-description"
          name="description"
          defaultValue={transaction?.description ?? ""}
          placeholder="ex. TikTok Ads octombrie"
        />
      </div>

      {error ? <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <DialogFooter className="sm:justify-between">
        {transaction && transaction.kind !== "commission" ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            disabled={pending}
            onClick={() =>
              confirm("Ștergi tranzacția?") &&
              startTransition(async () => {
                const result = await deleteTransaction(transaction.id);
                if (result.ok) {
                  toast.success("Șters");
                  onDone();
                } else toast.error(result.error);
              })
            }
          >
            <Trash2Icon /> Șterge
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Salvează
        </Button>
      </DialogFooter>
    </form>
  );
}
