"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { ArrowDownLeftIcon, ArrowUpRightIcon, CheckIcon, PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TransactionRow } from "@/lib/finance/queries";
import { formatDate, formatRON, toDecimal } from "@/lib/format";
import { fold } from "@/lib/leads/normalize";
import type { ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { setTransactionStatus } from "../actions";
import { KIND_LABEL, TransactionDialog, type ProjectOption } from "../transaction-dialog";

const ALL = "all";

export function TransactionsView({
  transactions,
  categories,
  projects,
  today,
}: {
  transactions: TransactionRow[];
  categories: ExpenseCategory[];
  projects: ProjectOption[];
  today: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const months = useMemo(() => [...new Set(transactions.map((t) => t.effective_date.slice(0, 7)))].sort().reverse(), [transactions]);
  const [month, setMonth] = useState(months.includes(today.slice(0, 7)) ? today.slice(0, 7) : ALL);
  const [type, setType] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [scope, setScope] = useState(ALL);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; tx: TransactionRow | null; type: "income" | "expense" }>({
    open: false,
    tx: null,
    type: "expense",
  });
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const rows = useMemo(() => {
    const terms = fold(search).split(/\s+/).filter(Boolean);
    return transactions
      .filter((t) => month === ALL || t.effective_date.startsWith(month))
      .filter((t) => type === ALL || t.type === type)
      .filter((t) => status === ALL || t.status === status)
      .filter((t) => category === ALL || (category === "none" ? !t.category_id : t.category_id === category))
      .filter((t) => scope === ALL || (t.type === "expense" && t.scope === scope))
      .filter((t) => {
        if (!terms.length) return true;
        const hay = fold([t.description, t.person, t.project?.client_name, KIND_LABEL[t.kind]].filter(Boolean).join(" "));
        return terms.every((term) => hay.includes(term));
      })
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  }, [transactions, month, type, status, category, scope, search]);

  const totals = rows.reduce(
    (acc, t) =>
      t.type === "income"
        ? { ...acc, income: acc.income.plus(toDecimal(t.amount)) }
        : { ...acc, expense: acc.expense.plus(toDecimal(t.amount)) },
    { income: new Decimal(0), expense: new Decimal(0) },
  );

  function markRealized(t: TransactionRow) {
    startTransition(async () => {
      const result = await setTransactionStatus(t.id, "realized");
      if (result.ok) {
        toast.success(t.type === "income" ? "Marcat ca încasat azi" : "Marcat ca plătit azi");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  const filterSelect = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    options: { value: string; label: string }[],
    width = "w-40",
  ) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className={width}>
        <SelectValue>{value === ALL ? label : options.find((o) => o.value === value)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută…" className="h-8 pl-8" />
        </div>
        {filterSelect(
          month,
          setMonth,
          "Toate lunile",
          months.map((m) => ({ value: m, label: format(parseISO(`${m}-01`), "LLLL yyyy", { locale: ro }) })),
        )}
        {filterSelect(
          type,
          setType,
          "Încasări și cheltuieli",
          [
            { value: "income", label: "Încasări" },
            { value: "expense", label: "Cheltuieli" },
          ],
          "w-44",
        )}
        {filterSelect(status, setStatus, "Orice status", [
          { value: "realized", label: "Realizate" },
          { value: "planned", label: "Planificate" },
        ])}
        {filterSelect(
          category,
          setCategory,
          "Toate categoriile",
          [...categories.map((c) => ({ value: c.id, label: c.name })), { value: "none", label: "Fără categorie" }],
          "w-44",
        )}
        {filterSelect(
          scope,
          setScope,
          "Business + personal",
          [
            { value: "business", label: "Business" },
            { value: "personal", label: "Personal" },
          ],
          "w-44",
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, tx: null, type: "income" })}>
          <ArrowDownLeftIcon /> Încasare
        </Button>
        <Button size="sm" onClick={() => setDialog({ open: true, tx: null, type: "expense" })}>
          <PlusIcon /> Cheltuială
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr className="[&>th]:h-9 [&>th]:px-3 [&>th]:text-left [&>th]:font-medium [&>th]:whitespace-nowrap">
                <th>Data</th>
                <th>Descriere</th>
                <th>Categorie</th>
                <th>Proiect</th>
                <th>Status</th>
                <th className="text-right!">Sumă</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const cat = t.category_id ? categoryById.get(t.category_id) : undefined;
                const overdue = t.status === "planned" && t.due_date < today;
                return (
                  <tr
                    key={t.id}
                    className={cn(
                      "cursor-pointer border-t hover:bg-muted/40 [&>td]:px-3 [&>td]:py-2",
                      t.status === "planned" && "text-muted-foreground",
                    )}
                    onClick={() => setDialog({ open: true, tx: t, type: t.type })}
                  >
                    <td className="whitespace-nowrap tabular-nums">{formatDate(t.effective_date)}</td>
                    <td className="max-w-72">
                      <div className="flex items-center gap-1.5">
                        {t.type === "income" ? (
                          <ArrowDownLeftIcon className="size-3.5 shrink-0 text-success" />
                        ) : (
                          <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate text-foreground">{t.description || t.person || KIND_LABEL[t.kind]}</span>
                      </div>
                      <div className="truncate pl-5 text-xs text-muted-foreground">
                        {KIND_LABEL[t.kind]}
                        {t.person && t.description ? ` · ${t.person}` : ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      {cat ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                      ) : null}
                      {t.type === "expense" && t.scope === "personal" ? (
                        <span className="ml-1.5 rounded bg-muted px-1 text-[11px]">personal</span>
                      ) : null}
                    </td>
                    <td className="max-w-44 truncate">
                      {t.project ? (
                        <Link href={`/proiecte/${t.project.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                          {t.project.client_name}
                        </Link>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap">
                      {t.status === "realized" ? (
                        <span className="text-success">{t.type === "income" ? "Încasat" : "Plătit"}</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className={cn(overdue && "font-medium text-destructive")}>{overdue ? "Restant" : "Planificat"}</span>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              markRealized(t);
                            }}
                          >
                            <CheckIcon /> {t.type === "income" ? "Încasat" : "Plătit"}
                          </Button>
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "text-right font-medium whitespace-nowrap tabular-nums",
                        t.type === "income" ? "text-success" : "text-foreground",
                      )}
                    >
                      {t.type === "income" ? "+" : "−"}
                      {formatRON(t.amount)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Nicio tranzacție pentru filtrele alese.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t bg-muted/30 px-3 py-2 text-sm tabular-nums">
          <span>
            {rows.length} tranzacții · Încasări <b className="text-success">{formatRON(totals.income)}</b>
          </span>
          <span>
            Cheltuieli <b>{formatRON(totals.expense)}</b>
          </span>
          <span>
            Diferență{" "}
            <b className={cn(totals.income.minus(totals.expense).isNegative() && "text-destructive")}>
              {formatRON(totals.income.minus(totals.expense))}
            </b>
          </span>
        </div>
      </div>

      <TransactionDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        transaction={dialog.tx}
        defaultType={dialog.type}
        categories={categories}
        projects={projects}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
