"use client";

import { useRef, useState, useTransition } from "react";
import Decimal from "decimal.js";
import { FileSpreadsheetIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatAmount, parseMoneyInput } from "@/lib/format";
import { fold } from "@/lib/leads/normalize";
import { importForecast } from "../actions";

const MONTHS = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

type ImportMonth = {
  month: string;
  projects: { name: string; revenue: string; actor: string; cameraman: string; editor: string }[];
  fixedCosts: { name: string; amount: string }[];
};

type Cell = string | number | boolean | Date | null | undefined;

function money(cell: Cell): string {
  if (typeof cell === "number") return cell > 0 ? cell.toFixed(2) : "0";
  if (typeof cell === "string" && cell.trim()) return parseMoneyInput(cell) ?? "0";
  return "0";
}

const text = (cell: Cell) => (cell === null || cell === undefined ? "" : String(cell).trim());

/**
 * Citește formatul „Proiecție PnL”: câte o foaie pe lună (Ianuarie…Decembrie), cu tabelul
 * „Nume proiect | Venituri | Actor | Cameraman | Editor …” până la „TOTAL”,
 * apoi „COSTURI FIXE” (denumire | sumă) până la „Total costuri fixe”.
 */
export function parsePnlWorkbook(sheets: { sheet: string; data: Cell[][] }[], year: number): ImportMonth[] {
  const result: ImportMonth[] = [];
  for (const { sheet, data } of sheets) {
    const index = MONTHS.indexOf(fold(sheet).trim());
    if (index < 0) continue;
    const first = (row: Cell[] | undefined) => fold(text(row?.[0]));
    const projects: ImportMonth["projects"] = [];
    const fixedCosts: ImportMonth["fixedCosts"] = [];

    const header = data.findIndex((row) => first(row) === "nume proiect");
    if (header >= 0) {
      for (let i = header + 1; i < data.length && !first(data[i]).startsWith("total"); i++) {
        const row = data[i] ?? [];
        const p = { name: text(row[0]), revenue: money(row[1]), actor: money(row[2]), cameraman: money(row[3]), editor: money(row[4]) };
        if (p.name || [p.revenue, p.actor, p.cameraman, p.editor].some((v) => Number(v) > 0)) projects.push(p);
      }
    }
    const fixed = data.findIndex((row) => first(row) === "costuri fixe");
    if (fixed >= 0) {
      for (let i = fixed + 1; i < data.length && !first(data[i]).startsWith("total"); i++) {
        const row = data[i] ?? [];
        const c = { name: text(row[0]), amount: money(row[1]) };
        if (Number(c.amount) > 0) fixedCosts.push(c);
      }
    }
    // Lunile goale din fișier nu șterg ce ai deja în aplicație.
    if (projects.length || fixedCosts.length) {
      result.push({ month: `${year}-${String(index + 1).padStart(2, "0")}-01`, projects, fixedCosts });
    }
  }
  return result.sort((a, b) => a.month.localeCompare(b.month));
}

export function ForecastImport({ year, onDone }: { year: number; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ file: string; months: ImportMonth[] } | null>(null);
  const [pending, startTransition] = useTransition();

  async function read(file: File) {
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const sheets = await readXlsxFile(file);
      const months = parsePnlWorkbook(sheets as { sheet: string; data: Cell[][] }[], year);
      if (!months.length) {
        toast.error("N-am găsit luni cu date. Fișierul trebuie să aibă câte o foaie pe lună (Ianuarie, Februarie…) ca în modelul P&L.");
        return;
      }
      setPreview({ file: file.name, months });
    } catch {
      toast.error("Nu am putut citi fișierul. Verifică să fie .xlsx.");
    }
  }

  const sum = (values: string[]) => values.reduce((acc, v) => acc.plus(v), new Decimal(0));

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void read(file);
        }}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <FileSpreadsheetIcon /> Importă din Excel
      </Button>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import forecast {year}</DialogTitle>
            <DialogDescription>
              Din „{preview?.file}”. Lunile de mai jos își înlocuiesc estimările din aplicație; celelalte rămân cum sunt.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr className="[&>th]:h-8 [&>th]:px-3 [&>th]:text-right [&>th]:font-medium">
                  <th className="text-left!">Luna</th>
                  <th>Proiecte</th>
                  <th>Venituri</th>
                  <th>Costuri fixe</th>
                </tr>
              </thead>
              <tbody>
                {preview?.months.map((m) => (
                  <tr key={m.month} className="border-t [&>td]:px-3 [&>td]:py-1.5 [&>td]:text-right [&>td]:tabular-nums">
                    <td className="text-left! capitalize">{MONTHS[Number(m.month.slice(5, 7)) - 1]}</td>
                    <td>{m.projects.length}</td>
                    <td>{formatAmount(sum(m.projects.map((p) => p.revenue)))}</td>
                    <td>{formatAmount(sum(m.fixedCosts.map((c) => c.amount)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)} disabled={pending}>
              Anulează
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await importForecast(preview!.months);
                  if (!result.ok) return void toast.error(result.error);
                  toast.success(
                    `Importat: ${result.data.months} luni, ${result.data.projects} proiecte, ${result.data.fixedCosts} costuri fixe`,
                  );
                  setPreview(null);
                  onDone();
                })
              }
            >
              Importă {preview?.months.length} luni
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
