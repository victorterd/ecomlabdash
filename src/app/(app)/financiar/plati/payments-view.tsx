"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TransactionRow } from "@/lib/finance/queries";
import { formatDate, formatRON, toDecimal } from "@/lib/format";
import type { ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { setTransactionStatus } from "../actions";
import { KIND_LABEL, TransactionDialog, type ProjectOption } from "../transaction-dialog";

type Group = { key: string; label: string; rows: TransactionRow[]; tone?: "bad" | "warn" };

function groupRows(rows: TransactionRow[], today: string, weekEnd: string, monthEnd: string): Group[] {
  const groups: Group[] = [
    { key: "overdue", label: "Restante", rows: [], tone: "bad" },
    { key: "week", label: "Următoarele 7 zile", rows: [], tone: "warn" },
    { key: "month", label: "Până la final de lună", rows: [] },
    { key: "later", label: "Mai târziu", rows: [] },
  ];
  for (const t of [...rows].sort((a, b) => a.due_date.localeCompare(b.due_date))) {
    if (t.due_date < today) groups[0]!.rows.push(t);
    else if (t.due_date <= weekEnd) groups[1]!.rows.push(t);
    else if (t.due_date <= monthEnd) groups[2]!.rows.push(t);
    else groups[3]!.rows.push(t);
  }
  return groups.filter((g) => g.rows.length);
}

const total = (rows: TransactionRow[]) => rows.reduce((acc, t) => acc.plus(toDecimal(t.amount)), new Decimal(0));

export function PaymentsView({
  planned,
  categories,
  projects,
  today,
  weekEnd,
  monthEnd,
}: {
  planned: TransactionRow[];
  categories: ExpenseCategory[];
  projects: ProjectOption[];
  today: string;
  weekEnd: string;
  monthEnd: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [showLater, setShowLater] = useState(false);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const expenses = planned.filter((t) => t.type === "expense");
  const incomes = planned.filter((t) => t.type === "income");

  function markDone(t: TransactionRow) {
    startTransition(async () => {
      const result = await setTransactionStatus(t.id, "realized");
      if (result.ok) {
        toast.success(t.type === "income" ? "Încasat azi" : "Plătit azi");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  const section = (title: string, rows: TransactionRow[], doneLabel: string) => {
    const groups = groupRows(rows, today, weekEnd, monthEnd);
    const dueNow = rows.filter((t) => t.due_date <= monthEnd);
    return (
      <section className="grid content-start gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <span className="text-sm text-muted-foreground">
            până la final de lună: <b className="text-foreground tabular-nums">{formatRON(total(dueNow))}</b>
          </span>
        </div>
        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Nimic planificat.</p>
        ) : null}
        {groups
          .filter((g) => g.key !== "later" || showLater)
          .map((g) => (
            <div key={g.key} className="overflow-hidden rounded-lg border">
              <div
                className={cn(
                  "flex items-center justify-between bg-muted/50 px-3 py-1.5 text-xs font-medium",
                  g.tone === "bad" && "bg-danger-soft text-destructive",
                  g.tone === "warn" && "bg-warning-soft text-warning",
                )}
              >
                <span>
                  {g.label} · {g.rows.length}
                </span>
                <span className="tabular-nums">{formatRON(total(g.rows))}</span>
              </div>
              <div className="divide-y">
                {g.rows.map((t) => {
                  const cat = t.category_id ? categoryById.get(t.category_id) : undefined;
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className={cn("w-20 shrink-0 tabular-nums", g.key === "overdue" && "font-medium text-destructive")}>
                        {formatDate(t.due_date)}
                      </span>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(t)}>
                        <div className="truncate font-medium hover:underline">{t.description || t.person || KIND_LABEL[t.kind]}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[KIND_LABEL[t.kind], t.person && t.description ? t.person : null, cat?.name].filter(Boolean).join(" · ")}
                          {t.project ? (
                            <>
                              {" · "}
                              <Link href={`/proiecte/${t.project.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                                {t.project.client_name}
                              </Link>
                            </>
                          ) : null}
                        </div>
                      </button>
                      <span className="shrink-0 font-semibold tabular-nums">{formatRON(t.amount)}</span>
                      <Button size="xs" variant="outline" onClick={() => markDone(t)}>
                        <CheckIcon /> {doneLabel}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        {!showLater && groups.some((g) => g.key === "later") ? (
          <Button variant="ghost" size="sm" className="w-fit" onClick={() => setShowLater(true)}>
            Arată și ce urmează după luna asta ({groups.find((g) => g.key === "later")!.rows.length})
          </Button>
        ) : null}
      </section>
    );
  };

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      {section("De plătit", expenses, "Plătit")}
      {section("De încasat", incomes, "Încasat")}
      <TransactionDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        transaction={editing}
        categories={categories}
        projects={projects}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
