"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { Loader2Icon, PlusIcon, RepeatIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/date-field";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RecurringExpense } from "@/lib/finance/queries";
import { formatRON } from "@/lib/format";
import type { ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteRecurring, saveRecurring } from "../actions";

const monthLabel = (iso: string | null) => (iso ? format(parseISO(iso), "LLLL yyyy", { locale: ro }) : "");

export function RecurringView({ rules, categories, today }: { rules: RecurringExpense[]; categories: ExpenseCategory[]; today: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ open: boolean; rule: RecurringExpense | null }>({ open: false, rule: null });
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="grid max-w-4xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Costuri fixe lunare (ex. contabilitatea). Pentru fiecare se generează automat cheltuieli planificate pe următoarele 12 luni. Le
          marchezi ca plătite din „Plăți de făcut”.
        </p>
        <Button size="sm" onClick={() => setDialog({ open: true, rule: null })}>
          <PlusIcon /> Cheltuială recurentă
        </Button>
      </div>
      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
          Nicio cheltuială recurentă.
        </div>
      ) : (
        <div className="surface divide-y">
          {rules.map((r) => {
            const ended = r.end_month !== null && r.end_month < today.slice(0, 8) + "01";
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setDialog({ open: true, rule: r })}
                className={cn(
                  "flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/40",
                  (!r.active || ended) && "opacity-60",
                )}
              >
                <RepeatIcon className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.description}</div>
                  <div className="text-xs text-muted-foreground">
                    în fiecare lună pe {r.day_of_month} · {categoryById.get(r.category_id ?? "")?.name ?? "fără categorie"}
                    {r.scope === "personal" ? " · personal" : ""} · din {monthLabel(r.start_month)}
                    {r.end_month ? ` până în ${monthLabel(r.end_month)}` : ""}
                    {!r.active ? " · oprită" : ""}
                  </div>
                </div>
                <span className="font-semibold tabular-nums">{formatRON(r.amount)} / lună</span>
              </button>
            );
          })}
        </div>
      )}
      <RecurringDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        rule={dialog.rule}
        categories={categories}
        today={today}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function RecurringDialog({
  open,
  onOpenChange,
  rule,
  categories,
  today,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: RecurringExpense | null;
  categories: ExpenseCategory[];
  today: string;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? "Editează cheltuiala recurentă" : "Cheltuială recurentă nouă"}</DialogTitle>
        </DialogHeader>
        {open ? (
          <RecurringForm
            key={rule?.id ?? "new"}
            rule={rule}
            categories={categories}
            today={today}
            onDone={() => {
              onOpenChange(false);
              onSaved();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RecurringForm({
  rule,
  categories,
  today,
  onDone,
}: {
  rule: RecurringExpense | null;
  categories: ExpenseCategory[];
  today: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const defaultCategory = categories.find((c) => /contab/i.test(c.name))?.id ?? categories[0]?.id ?? "";
  const [amount, setAmount] = useState<string | null>(rule?.amount ?? null);
  const [categoryId, setCategoryId] = useState(rule?.category_id ?? defaultCategory);
  const [scope, setScope] = useState<"business" | "personal">(rule?.scope ?? "business");
  const [start, setStart] = useState<string | null>(rule?.start_month ?? `${today.slice(0, 7)}-01`);
  const [end, setEnd] = useState<string | null>(rule?.end_month ?? null);
  const [active, setActive] = useState(rule?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await saveRecurring(rule?.id ?? null, {
            description: String(data.get("description") ?? ""),
            amount: amount ?? "",
            category_id: categoryId,
            scope,
            day_of_month: String(data.get("day_of_month") ?? ""),
            start_month: start ?? "",
            end_month: end,
            active,
          });
          if (result.ok) {
            toast.success(rule ? "Actualizat; lunile viitoare au fost recalculate" : "Adăugat; s-au planificat următoarele 12 luni");
            onDone();
          } else setError(result.error);
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="rec-desc">Descriere *</Label>
        <Input id="rec-desc" name="description" defaultValue={rule?.description ?? "Contabilitate"} required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Sumă lunară *</Label>
          <MoneyInput value={amount} onCommit={setAmount} allowEmpty aria-label="Sumă lunară" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rec-day">Ziua din lună</Label>
          <Input id="rec-day" name="day_of_month" type="number" min={1} max={31} defaultValue={rule?.day_of_month ?? 1} />
        </div>
        <div className="grid gap-1.5">
          <Label>Categorie</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue>{categories.find((c) => c.id === categoryId)?.name ?? "Alege…"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories
                .filter((c) => c.active || c.id === categoryId)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Business / Personal</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as "business" | "personal")}>
            <SelectTrigger>
              <SelectValue>{scope === "business" ? "Business" : "Personal"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Începând cu luna</Label>
          <DateField value={start} onChange={setStart} clearable={false} aria-label="Începând cu" />
        </div>
        <div className="grid gap-1.5">
          <Label>Până la (opțional)</Label>
          <DateField value={end} onChange={setEnd} aria-label="Până la" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} /> Activă
      </label>
      <p className="text-xs text-muted-foreground">Se folosește doar luna din date. Lunile deja plătite nu se modifică.</p>
      {error ? <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <DialogFooter className="sm:justify-between">
        {rule ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            disabled={pending}
            onClick={() =>
              confirm("Ștergi cheltuiala recurentă? Lunile viitoare neplătite dispar, cele plătite rămân.") &&
              startTransition(async () => {
                const result = await deleteRecurring(rule.id);
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
