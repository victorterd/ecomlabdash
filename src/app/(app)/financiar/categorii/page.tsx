import Decimal from "decimal.js";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { includeTx, monthKey, monthRange } from "@/lib/finance/calc";
import { fetchCategories, fetchTransactions } from "@/lib/finance/queries";
import { formatAmount, todayISO, toDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseYearMode, YearModeBar } from "../mode-toggle";

export const metadata = { title: "Cheltuieli pe categorii" };

const ZERO = new Decimal(0);

export default async function CategoriesPage({ searchParams }: PageProps<"/financiar/categorii">) {
  const today = todayISO();
  const { year, withPlanned } = parseYearMode(await searchParams, Number(today.slice(0, 4)));
  const months = monthRange(`${year}-01`, 12);
  const [transactions, categories] = await Promise.all([
    fetchTransactions({ from: `${year}-01-01`, to: `${year}-12-31` }),
    fetchCategories(),
  ]);

  // categorie (sau „none”) → lună → sumă; separat business / personal
  const grid = new Map<string, Map<string, Decimal>>();
  const scopeTotals = { business: new Map<string, Decimal>(), personal: new Map<string, Decimal>() };
  for (const t of transactions) {
    if (t.type !== "expense" || !includeTx(t, withPlanned)) continue;
    const key = t.category_id ?? "none";
    const month = monthKey(t.effective_date);
    const row = grid.get(key) ?? new Map<string, Decimal>();
    row.set(month, (row.get(month) ?? ZERO).plus(toDecimal(t.amount)));
    grid.set(key, row);
    const scopeMap = scopeTotals[t.scope];
    scopeMap.set(month, (scopeMap.get(month) ?? ZERO).plus(toDecimal(t.amount)));
  }

  const rows = [
    ...categories.filter((c) => grid.has(c.id) || c.active).map((c) => ({ id: c.id, name: c.name, color: c.color })),
    ...(grid.has("none") ? [{ id: "none", name: "Fără categorie", color: "#94a3b8" }] : []),
  ];
  const rowTotal = (m: Map<string, Decimal> | undefined) => [...(m?.values() ?? [])].reduce((a, b) => a.plus(b), ZERO);
  const currentMonth = monthKey(today);
  const cell = (v: Decimal | undefined, highlight: boolean, key: string) => (
    <td key={key} className={cn(!v || v.isZero() ? "text-muted-foreground/50" : "", highlight && "bg-accent/40")}>
      {v && !v.isZero() ? formatAmount(v) : "—"}
    </td>
  );
  const allTotal = (month: string) =>
    scopeTotals.business.get(month)?.plus(scopeTotals.personal.get(month) ?? ZERO) ?? scopeTotals.personal.get(month);

  return (
    <div className="grid gap-4">
      <YearModeBar basePath="/financiar/categorii" year={year} withPlanned={withPlanned} />
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr className="[&>th]:h-9 [&>th]:px-3 [&>th]:text-right [&>th]:font-medium [&>th]:whitespace-nowrap">
                <th className="sticky left-0 z-10 bg-muted text-left!">Categorie</th>
                {months.map((m) => (
                  <th key={m} className={cn("capitalize", m === currentMonth && "bg-accent text-accent-foreground")}>
                    {format(parseISO(`${m}-01`), "LLL", { locale: ro })}
                  </th>
                ))}
                <th className="border-l">Total {year}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t [&>td]:px-3 [&>td]:py-1.5 [&>td]:text-right [&>td]:whitespace-nowrap [&>td]:tabular-nums"
                >
                  <td className="sticky left-0 z-10 bg-card text-left!">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className="size-2 rounded-full" style={{ backgroundColor: r.color }} />
                      {r.name}
                    </span>
                  </td>
                  {months.map((m) => cell(grid.get(r.id)?.get(m), m === currentMonth, m))}
                  <td className="border-l bg-muted/30 font-medium">{formatAmount(rowTotal(grid.get(r.id)))}</td>
                </tr>
              ))}
              {(["business", "personal"] as const).map((scope) => (
                <tr
                  key={scope}
                  className="border-t text-muted-foreground [&>td]:px-3 [&>td]:py-1.5 [&>td]:text-right [&>td]:whitespace-nowrap [&>td]:tabular-nums"
                >
                  <td className="sticky left-0 z-10 bg-card text-left!">
                    din care {scope === "business" ? "business" : "personale"}
                  </td>
                  {months.map((m) => cell(scopeTotals[scope].get(m), m === currentMonth, m))}
                  <td className="border-l bg-muted/30">{formatAmount(rowTotal(scopeTotals[scope]))}</td>
                </tr>
              ))}
              <tr className="border-t-2 font-semibold [&>td]:px-3 [&>td]:py-1.5 [&>td]:text-right [&>td]:whitespace-nowrap [&>td]:tabular-nums">
                <td className="sticky left-0 z-10 bg-card text-left!">Total cheltuieli</td>
                {months.map((m) => cell(allTotal(m), m === currentMonth, m))}
                <td className="border-l bg-muted/30">
                  {formatAmount(rowTotal(scopeTotals.business).plus(rowTotal(scopeTotals.personal)))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
