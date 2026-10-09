"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRON } from "@/lib/format";

type Point = { month: string; label: string; revenue: number; expenses: number; balance: number | null };

// Paletă categorială validată (slot 1 albastru, slot 2 portocaliu), cu pași separați pentru dark mode.
const COLORS = `
  .fin-charts { --series-1: #2a78d6; --series-2: #eb6834; --grid: #e7e8e6; --axis: #6b716c; }
  .dark .fin-charts { --series-1: #3987e5; --series-2: #d95926; --grid: #262a26; --axis: #9aa29b; }
`;

const compact = new Intl.NumberFormat("ro-RO", { notation: "compact", maximumFractionDigits: 1 });

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium capitalize">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">{formatRON(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function FinanceCharts({ data, currentMonth }: { data: Point[]; currentMonth: string }) {
  const current = data.find((d) => d.month === currentMonth)?.label;
  const axis = { stroke: "var(--axis)", fontSize: 11, tickLine: false, axisLine: false } as const;

  return (
    <section className="fin-charts grid gap-4 lg:grid-cols-2">
      <style>{COLORS}</style>
      <div className="rounded-xl border p-4">
        <h3 className="mb-3 text-sm font-semibold">Venituri vs. cheltuieli pe luni</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="25%" margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" {...axis} className="capitalize" />
              <YAxis {...axis} width={48} tickFormatter={(v: number) => compact.format(v)} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--grid)", opacity: 0.5 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} itemSorter={null} />
              {current ? <ReferenceLine x={current} stroke="var(--axis)" strokeDasharray="3 3" /> : null}
              <Bar
                dataKey="revenue"
                name="Venituri"
                fill="var(--series-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
                isAnimationActive={false}
              />
              <Bar
                dataKey="expenses"
                name="Cheltuieli"
                fill="var(--series-2)"
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl border p-4">
        <h3 className="mb-3 text-sm font-semibold">Evoluția soldului (final de lună)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} width={48} tickFormatter={(v: number) => compact.format(v)} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--axis)", strokeDasharray: "3 3" }} />
              <ReferenceLine y={0} stroke="var(--axis)" />
              {current ? <ReferenceLine x={current} stroke="var(--axis)" strokeDasharray="3 3" /> : null}
              <Line
                type="monotone"
                dataKey="balance"
                name="Sold"
                stroke="var(--series-1)"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: "var(--series-1)" }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
