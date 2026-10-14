"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { ChevronLeftIcon, ChevronRightIcon, CopyIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ForecastFixedCost, ForecastProject } from "@/lib/finance/queries";
import { formatAmount, formatNumber, formatPercent, formatRON, parseMoneyInput, toDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addForecastRow, copyForecastMonth, deleteForecastRow, type ForecastKind, type ForecastRow, updateForecastRow } from "../actions";
import { ForecastImport } from "./forecast-import";

export type ActualMonth = {
  month: string;
  plannedIncome: string;
  plannedExpense: string;
  realizedIncome: string;
  realizedExpense: string;
  /** Soldul real la final de lună (doar pentru lunile trecute). */
  closingBalance: string | null;
};

type MonthPnl = { revenue: Decimal; direct: Decimal; gross: Decimal; fixed: Decimal; net: Decimal };

const COST_FIELDS = ["actor", "cameraman", "editor"] as const;
const zero = () => new Decimal(0);

const projectCosts = (p: ForecastProject) => COST_FIELDS.reduce((acc, f) => acc.plus(toDecimal(p[f])), zero());

function pnl(projects: ForecastProject[], fixedCosts: ForecastFixedCost[]): MonthPnl {
  const revenue = projects.reduce((acc, p) => acc.plus(toDecimal(p.revenue)), zero());
  const direct = projects.reduce((acc, p) => acc.plus(projectCosts(p)), zero());
  const fixed = fixedCosts.reduce((acc, c) => acc.plus(toDecimal(c.amount)), zero());
  const gross = revenue.minus(direct);
  return { revenue, direct, gross, fixed, net: gross.minus(fixed) };
}

const margin = (profit: Decimal, revenue: Decimal) => (revenue.isZero() ? null : profit.div(revenue).times(100));
const monthLabel = (m: string, pattern = "LLLL yyyy") => format(parseISO(`${m}-01`), pattern, { locale: ro });

export function ForecastView({
  year,
  selectedMonth,
  currentMonth,
  projects: initialProjects,
  fixedCosts: initialFixed,
  actual,
  startBalance,
}: {
  year: number;
  selectedMonth: string;
  currentMonth: string;
  projects: ForecastProject[];
  fixedCosts: ForecastFixedCost[];
  actual: ActualMonth[];
  startBalance: string;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [fixedCosts, setFixedCosts] = useState(initialFixed);
  const [prev, setPrev] = useState({ initialProjects, initialFixed });
  if (prev.initialProjects !== initialProjects || prev.initialFixed !== initialFixed) {
    setPrev({ initialProjects, initialFixed });
    setProjects(initialProjects);
    setFixedCosts(initialFixed);
  }
  const [month, setMonthState] = useState(selectedMonth);
  const [pending, startTransition] = useTransition();
  // Rândul nou primește cursorul pe nume, după ce apare pe ecran.
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`forecast-${focusId}-name`)?.focus();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- focus o singură dată
    setFocusId(null);
  }, [focusId, projects, fixedCosts]);

  function setMonth(m: string) {
    setMonthState(m);
    const url = new URL(window.location.href);
    url.searchParams.set("an", String(year));
    url.searchParams.set("luna", String(Number(m.slice(5))));
    window.history.replaceState(null, "", url);
  }

  const months = actual.map((a) => a.month);
  const byMonth = new Map(
    months.map((m) => [
      m,
      pnl(
        projects.filter((p) => p.month.startsWith(m)),
        fixedCosts.filter((c) => c.month.startsWith(m)),
      ),
    ]),
  );
  const total = [...byMonth.values()].reduce(
    (acc, p) => ({
      revenue: acc.revenue.plus(p.revenue),
      direct: acc.direct.plus(p.direct),
      gross: acc.gross.plus(p.gross),
      fixed: acc.fixed.plus(p.fixed),
      net: acc.net.plus(p.net),
    }),
    { revenue: zero(), direct: zero(), gross: zero(), fixed: zero(), net: zero() },
  );

  // --- editare rânduri -------------------------------------------------
  function setRows(kind: ForecastKind, update: (rows: ForecastRow[]) => ForecastRow[]) {
    if (kind === "project") setProjects((rows) => update(rows as unknown as ForecastRow[]) as unknown as ForecastProject[]);
    else setFixedCosts((rows) => update(rows as unknown as ForecastRow[]) as unknown as ForecastFixedCost[]);
  }

  function add(kind: ForecastKind) {
    startTransition(async () => {
      const result = await addForecastRow(kind, `${month}-01`);
      if (!result.ok) return void toast.error(result.error);
      setRows(kind, (rows) => [...rows, result.data]);
      setFocusId(result.data.id);
    });
  }

  function save(kind: ForecastKind, row: ForecastRow, field: string, raw: string) {
    let value: string = raw.trim();
    if (field !== "name") {
      const parsed = value ? parseMoneyInput(value) : "0";
      if (parsed === null) return void toast.error("Sumă invalidă");
      if (Number(parsed) === Number(row[field] ?? 0)) return;
      value = parsed;
    } else if (value === row.name) return;
    setRows(kind, (rows) => rows.map((r) => (r.id === row.id ? { ...r, [field]: value } : r)));
    startTransition(async () => {
      const result = await updateForecastRow(kind, row.id, { [field]: value });
      if (!result.ok) {
        toast.error(result.error);
        setRows(kind, (rows) => rows.map((r) => (r.id === row.id ? row : r)));
      }
    });
  }

  function remove(kind: ForecastKind, row: ForecastRow) {
    setRows(kind, (rows) => rows.filter((r) => r.id !== row.id));
    startTransition(async () => {
      const result = await deleteForecastRow(kind, row.id);
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  const monthIndex = months.indexOf(month);
  const previousMonth = monthIndex > 0 ? months[monthIndex - 1]! : `${year - 1}-12`;
  const monthProjects = projects.filter((p) => p.month.startsWith(month));
  const monthFixed = fixedCosts.filter((c) => c.month.startsWith(month));
  const monthPnl = byMonth.get(month) ?? pnl([], []);

  function copyPrevious() {
    startTransition(async () => {
      const result = await copyForecastMonth(`${previousMonth}-01`, `${month}-01`);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Copiat din ${monthLabel(previousMonth, "LLLL")}`);
      router.refresh();
    });
  }

  // --- forecast vs planificat vs realizat ------------------------------
  const balances: ({ planned: Decimal; forecast: Decimal } | null)[] = [];
  let running: { planned: Decimal; forecast: Decimal } | null = null;
  for (const a of actual) {
    if (a.month < currentMonth) {
      balances.push(a.closingBalance ? { planned: toDecimal(a.closingBalance), forecast: toDecimal(a.closingBalance) } : null);
      continue;
    }
    const prevBalance: { planned: Decimal; forecast: Decimal } = running ?? {
      planned: toDecimal(startBalance),
      forecast: toDecimal(startBalance),
    };
    const p = byMonth.get(a.month)!;
    const fExp = p.direct.plus(p.fixed);
    // O lună fără estimare folosește planificatul; forecast-ul nu coboară sub ce s-a realizat deja.
    const inc = p.revenue.isZero() ? toDecimal(a.plannedIncome) : Decimal.max(p.revenue, toDecimal(a.realizedIncome));
    const exp = fExp.isZero() ? toDecimal(a.plannedExpense) : Decimal.max(fExp, toDecimal(a.realizedExpense));
    running = {
      planned: prevBalance.planned.plus(a.plannedIncome).minus(a.plannedExpense),
      forecast: prevBalance.forecast.plus(inc).minus(exp),
    };
    balances.push(running);
  }

  const money = (v: Decimal.Value) => {
    const d = toDecimal(v as string);
    return d.isZero() ? <span className="text-muted-foreground/50">—</span> : formatAmount(d);
  };
  const th = "[&>th]:h-9 [&>th]:px-3 [&>th]:text-right [&>th]:font-medium [&>th]:whitespace-nowrap";
  const td = "[&>td]:px-3 [&>td]:py-1.5 [&>td]:text-right [&>td]:whitespace-nowrap [&>td]:tabular-nums";

  const cellInput = (kind: ForecastKind, row: ForecastRow, field: string, opts: { text?: boolean; label: string }) => (
    <input
      id={`forecast-${row.id}-${field}`}
      key={`${row.id}-${field}-${row[field]}`}
      defaultValue={opts.text ? String(row[field] ?? "") : Number(row[field]) ? formatNumber(String(row[field])) : ""}
      inputMode={opts.text ? "text" : "decimal"}
      placeholder={opts.text ? "Nume proiect" : "—"}
      aria-label={opts.label}
      className={cn(
        "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-input focus:border-ring focus:bg-card",
        !opts.text && "text-right tabular-nums",
      )}
      onBlur={(e) => save(kind, row, field, e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-8 [&>*]:min-w-0">
      {/* An + import */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={`/financiar/forecast?an=${year - 1}`} aria-label="Anul anterior">
            <ChevronLeftIcon />
          </Link>
        </Button>
        <h2 className="min-w-16 text-center text-lg font-semibold tabular-nums">{year}</h2>
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={`/financiar/forecast?an=${year + 1}`} aria-label="Anul următor">
            <ChevronRightIcon />
          </Link>
        </Button>
        <div className="flex-1" />
        <ForecastImport year={year} onDone={() => router.refresh()} />
      </div>

      {/* Rezumat anual */}
      <section className="grid gap-3">
        <div>
          <h2 className="text-base font-semibold">Rezumat anual</h2>
          <p className="text-sm text-muted-foreground">Se adună singur din lunile de mai jos. Click pe o lună ca s-o editezi.</p>
        </div>
        <div className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="table-head">
                <tr className={th}>
                  <th className="text-left!">Luna</th>
                  <th>Venituri</th>
                  <th>Costuri directe</th>
                  <th>Profit brut</th>
                  <th>Costuri fixe</th>
                  <th>Profit net</th>
                  <th>Marjă netă</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const p = byMonth.get(m)!;
                  const mg = margin(p.net, p.revenue);
                  return (
                    <tr
                      key={m}
                      onClick={() => setMonth(m)}
                      className={cn(
                        "cursor-pointer border-t hover:bg-muted/40",
                        td,
                        m === month && "bg-accent/60 hover:bg-accent/60",
                        p.revenue.isZero() && p.fixed.isZero() && "text-muted-foreground",
                      )}
                    >
                      <td className="text-left! capitalize">
                        <span className={cn(m === month && "font-semibold")}>{monthLabel(m, "LLLL")}</span>
                        {m === currentMonth ? (
                          <span className="ml-2 text-[11px] text-muted-foreground normal-case">luna curentă</span>
                        ) : null}
                      </td>
                      <td>{money(p.revenue)}</td>
                      <td>{money(p.direct)}</td>
                      <td>{money(p.gross)}</td>
                      <td>{money(p.fixed)}</td>
                      <td className={cn("font-medium", p.net.isNegative() && "text-destructive")}>{money(p.net)}</td>
                      <td className="text-muted-foreground">{mg ? formatPercent(mg.toFixed(1)) : ""}</td>
                    </tr>
                  );
                })}
                <tr className={cn("border-t-2 bg-muted/40 font-semibold", td)}>
                  <td className="text-left!">TOTAL AN</td>
                  <td>{formatAmount(total.revenue)}</td>
                  <td>{formatAmount(total.direct)}</td>
                  <td>{formatAmount(total.gross)}</td>
                  <td>{formatAmount(total.fixed)}</td>
                  <td className={cn(total.net.isNegative() && "text-destructive")}>{formatAmount(total.net)}</td>
                  <td>{margin(total.net, total.revenue) ? formatPercent(margin(total.net, total.revenue)!.toFixed(1)) : ""}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Luna selectată */}
      <section className="grid grid-cols-1 gap-4 [&>*]:min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold capitalize">{monthLabel(month)}</h2>
            <p className="text-sm text-muted-foreground">Completezi proiectele estimate și costurile fixe; restul se calculează singur.</p>
          </div>
          <div className="-mx-3 w-[calc(100%+1.5rem)] overflow-x-auto px-3 sm:mx-0 sm:w-auto sm:px-0">
            <div className="inline-flex w-max rounded-lg bg-muted p-1">
              {months.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonth(m)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground capitalize",
                    m === month && "bg-card text-foreground shadow-sm",
                  )}
                >
                  {monthLabel(m, "LLL")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Proiecte */}
        <div className="surface overflow-hidden">
          <div className="border-b px-4 py-3 text-sm font-semibold">Proiecte</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <colgroup>
                <col />
                <col className="w-32" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-20" />
                <col className="w-10" />
              </colgroup>
              <thead className="table-head">
                <tr className={th}>
                  <th className="text-left!">Nume proiect</th>
                  <th>Venituri</th>
                  <th>Actor</th>
                  <th>Cameraman</th>
                  <th>Editor</th>
                  <th>Total costuri</th>
                  <th>Profit</th>
                  <th>Marja</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {monthProjects.map((p) => {
                  const row = p as unknown as ForecastRow;
                  const costs = projectCosts(p);
                  const profit = toDecimal(p.revenue).minus(costs);
                  const mg = margin(profit, toDecimal(p.revenue));
                  return (
                    <tr key={p.id} className="group border-t [&>td]:px-1 [&>td]:py-1">
                      <td>{cellInput("project", row, "name", { text: true, label: "Nume proiect" })}</td>
                      <td>{cellInput("project", row, "revenue", { label: `Venituri ${p.name}` })}</td>
                      {COST_FIELDS.map((f) => (
                        <td key={f}>{cellInput("project", row, f, { label: `${f} ${p.name}` })}</td>
                      ))}
                      <td className="px-3! text-right tabular-nums">{money(costs)}</td>
                      <td className={cn("px-3! text-right font-medium tabular-nums", profit.isNegative() && "text-destructive")}>
                        {money(profit)}
                      </td>
                      <td className="px-3! text-right text-muted-foreground tabular-nums">{mg ? formatPercent(mg.toFixed(0)) : ""}</td>
                      <td>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 [@media(hover:none)]:opacity-60"
                          aria-label={`Șterge ${p.name || "rândul"}`}
                          onClick={() => remove("project", row)}
                        >
                          <Trash2Icon />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {monthProjects.length === 0 ? (
                  <tr className="border-t">
                    <td colSpan={9} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Niciun proiect estimat în luna asta.
                    </td>
                  </tr>
                ) : null}
                <tr className={cn("border-t-2 bg-muted/40 font-semibold", td)}>
                  <td className="text-left!">TOTAL</td>
                  <td>{formatAmount(monthPnl.revenue)}</td>
                  {COST_FIELDS.map((f) => (
                    <td key={f}>{formatAmount(monthProjects.reduce((acc, p) => acc.plus(toDecimal(p[f])), zero()))}</td>
                  ))}
                  <td>{formatAmount(monthPnl.direct)}</td>
                  <td className={cn(monthPnl.gross.isNegative() && "text-destructive")}>{formatAmount(monthPnl.gross)}</td>
                  <td>
                    {margin(monthPnl.gross, monthPnl.revenue) ? formatPercent(margin(monthPnl.gross, monthPnl.revenue)!.toFixed(0)) : ""}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
            <Button variant="ghost" size="sm" onClick={() => add("project")} disabled={pending}>
              <PlusIcon /> Adaugă proiect
            </Button>
            {monthProjects.length === 0 && monthFixed.length === 0 ? (
              <Button variant="ghost" size="sm" onClick={copyPrevious} disabled={pending}>
                <CopyIcon /> Copiază din {monthLabel(previousMonth, "LLLL")}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] [&>*]:min-w-0">
          {/* Costuri fixe */}
          <div className="surface overflow-hidden">
            <div className="border-b px-4 py-3 text-sm font-semibold">Costuri fixe</div>
            <ul className="divide-y">
              {monthFixed.map((c) => {
                const row = c as unknown as ForecastRow;
                return (
                  <li key={c.id} className="group flex items-center gap-1 px-1 py-1">
                    <div className="min-w-0 flex-1">{cellInput("fixed", row, "name", { text: true, label: "Denumire cost fix" })}</div>
                    <div className="w-36">{cellInput("fixed", row, "amount", { label: `Sumă ${c.name}` })}</div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 [@media(hover:none)]:opacity-60"
                      aria-label={`Șterge ${c.name || "costul"}`}
                      onClick={() => remove("fixed", row)}
                    >
                      <Trash2Icon />
                    </Button>
                  </li>
                );
              })}
              {monthFixed.length === 0 ? (
                <li className="px-4 py-5 text-center text-sm text-muted-foreground">
                  Fără costuri fixe (contabilitate, abonamente, advertising…).
                </li>
              ) : null}
              <li className="flex items-center justify-between bg-muted/40 px-4 py-2 text-sm font-semibold">
                <span>Total costuri fixe</span>
                <span className="pr-10 tabular-nums">{formatAmount(monthPnl.fixed)}</span>
              </li>
            </ul>
            <div className="border-t px-3 py-2">
              <Button variant="ghost" size="sm" onClick={() => add("fixed")} disabled={pending}>
                <PlusIcon /> Adaugă cost fix
              </Button>
            </div>
          </div>

          {/* Profit net */}
          <div className="surface grid content-start gap-3 p-5">
            <div className="text-sm font-semibold">Rezultatul lunii</div>
            <Line label="Venituri" value={monthPnl.revenue} />
            <Line label="Costuri directe" value={monthPnl.direct.negated()} />
            <Line label="Profit brut" value={monthPnl.gross} strong />
            <Line label="Costuri fixe" value={monthPnl.fixed.negated()} />
            <div className="border-t pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">Profit net</span>
                <span
                  className={cn("text-2xl font-semibold tabular-nums", monthPnl.net.isNegative() ? "text-destructive" : "text-success")}
                >
                  {formatRON(monthPnl.net)}
                </span>
              </div>
              {margin(monthPnl.net, monthPnl.revenue) ? (
                <div className="mt-1 text-right text-xs text-muted-foreground">
                  marjă netă {formatPercent(margin(monthPnl.net, monthPnl.revenue)!.toFixed(1))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Forecast vs planificat vs realizat */}
      <section className="grid gap-3">
        <div>
          <h2 className="text-base font-semibold">Forecast vs. planificat vs. realizat</h2>
          <p className="text-sm text-muted-foreground">
            Forecast = ce ai estimat mai sus (cheltuieli = costuri directe + fixe). Planificat = tot ce e în cashflow pentru luna respectivă
            (încasat + de încasat, plătit + de plătit). Realizat = doar ce s-a încasat/plătit deja.
          </p>
        </div>
        <div className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr className={th}>
                  <th className="sticky left-0 z-10 min-w-48 bg-muted text-left!" />
                  {months.map((m) => (
                    <th key={m} className={cn("capitalize", m === currentMonth && "bg-accent text-accent-foreground")}>
                      {monthLabel(m, "LLL")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Venituri — forecast", (a: ActualMonth) => byMonth.get(a.month)!.revenue, "font-medium"],
                    ["Venituri — planificat", (a: ActualMonth) => a.plannedIncome, ""],
                    ["Venituri — realizat", (a: ActualMonth) => a.realizedIncome, "text-muted-foreground"],
                    [
                      "Cheltuieli — forecast",
                      (a: ActualMonth) => byMonth.get(a.month)!.direct.plus(byMonth.get(a.month)!.fixed),
                      "font-medium border-t-2",
                    ],
                    ["Cheltuieli — planificat", (a: ActualMonth) => a.plannedExpense, ""],
                    ["Cheltuieli — realizat", (a: ActualMonth) => a.realizedExpense, "text-muted-foreground"],
                  ] as const
                ).map(([name, get, cls]) => (
                  <tr key={name} className={cn("border-t", td, cls)}>
                    <td className="sticky left-0 z-10 bg-card text-left!">{name}</td>
                    {actual.map((a) => (
                      <td key={a.month} className={cn(a.month === currentMonth && "bg-accent/40")}>
                        {money(get(a))}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className={cn("border-t-2 font-semibold", td)}>
                  <td className="sticky left-0 z-10 bg-card text-left!">Sold (planificat)</td>
                  {balances.map((b, i) => (
                    <td
                      key={months[i]}
                      className={cn(b?.planned.isNegative() && "text-destructive", months[i]! < currentMonth && "text-muted-foreground")}
                    >
                      {b ? formatAmount(b.planned) : ""}
                    </td>
                  ))}
                </tr>
                <tr className={cn("border-t font-semibold", td)}>
                  <td className="sticky left-0 z-10 bg-card text-left!">Sold (forecast)</td>
                  {balances.map((b, i) => (
                    <td
                      key={months[i]}
                      className={cn(b?.forecast.isNegative() && "text-destructive", months[i]! < currentMonth && "text-muted-foreground")}
                    >
                      {b ? formatAmount(b.forecast) : ""}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Lunile trecute arată soldul real de la final de lună. De la luna curentă încolo, soldurile pornesc de la soldul real de la
          începutul lunii ({formatRON(startBalance)}). La „forecast”, o lună fără estimare folosește valorile planificate, iar o estimare
          mai mică decât ce s-a realizat deja e înlocuită cu realizatul.
        </p>
      </section>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: Decimal; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={cn(strong ? "font-medium" : "text-muted-foreground")}>{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold", value.isNegative() && !strong && "text-muted-foreground")}>
        {formatRON(value)}
      </span>
    </div>
  );
}
