"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, CheckCircle2Icon, FileSpreadsheetIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { ColorBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, parseDateRO } from "@/lib/format";
import { cleanPhone, fold, formatPhone } from "@/lib/leads/normalize";
import { MATCHED_ON_LABEL } from "@/lib/leads/types";
import type { LeadSource, LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { checkDuplicates, finishImport, importLeadsChunk, startImport } from "../actions";
import { guessMapping, TARGET_FIELDS, type TargetField } from "./fields";
import { parseFile, type ParsedSheet } from "./parse-file";

const SKIP = "__skip__";
const NO_SOURCE = "__none__";
const CHUNK = 200;

type Step = "upload" | "mapping" | "preview" | "importing" | "done";

type PreviewRow = {
  row: number; // numărul rândului din fișier (1 = antet)
  values: {
    company_name: string;
    website: string | null;
    owner_name: string | null;
    email: string | null;
    phone1: string | null;
    phone2: string | null;
    status_id: string;
    source_id: string | null;
    called_by: string | null;
    follow_up_date: string | null;
    follow_up_time: null;
    potential: string | null;
    notes: string | null;
  };
  problem: { kind: "missing" | "db" | "file"; text: string } | null;
  included: boolean;
};

type Report = { imported: number; duplicates: number; manual: number; errors: { row: number; error: string }[] };

export function ImportWizard({ statuses, sources }: { statuses: LeadStatus[]; sources: LeadSource[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<Record<TargetField, number | null>>({} as Record<TargetField, number | null>);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [sourceMap, setSourceMap] = useState<Record<string, string>>({});
  const [defaultSource, setDefaultSource] = useState(sources.find((s) => s.active)?.id ?? NO_SOURCE);
  const [normalizePhones, setNormalizePhones] = useState(true);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultStatus = statuses.find((s) => s.is_default) ?? statuses[0]!;
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const sheet = sheets[sheetIndex];
  const headers = sheet?.rows[0] ?? [];
  const dataRows = useMemo(() => (sheet?.rows.slice(1) ?? []).filter((r) => r.some((c) => c.trim())), [sheet]);

  /** Valorile distincte dintr-o coloană (pentru maparea statusurilor / surselor). */
  function distinctValues(column: number | null): string[] {
    if (column === null) return [];
    return [...new Set(dataRows.map((r) => (r[column] ?? "").trim()))].sort((a, b) =>
      a === "" ? -1 : b === "" ? 1 : a.localeCompare(b, "ro"),
    );
  }

  function autoStatusMap(column: number | null): Record<string, string> {
    const map: Record<string, string> = {};
    for (const value of distinctValues(column)) {
      const match = value ? statuses.find((s) => fold(s.name) === fold(value)) : undefined;
      map[value] = match?.id ?? defaultStatus.id;
    }
    return map;
  }

  function autoSourceMap(column: number | null): Record<string, string> {
    const map: Record<string, string> = {};
    for (const value of distinctValues(column)) {
      const match = value ? sources.find((s) => fold(s.name) === fold(value)) : undefined;
      map[value] = match?.id ?? "";
    }
    return map;
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const parsed = (await parseFile(file)).filter((s) => s.rows.length > 1);
      if (!parsed.length) throw new Error("Fișierul nu conține rânduri de date (sub antet).");
      setFileName(file.name);
      setSheets(parsed);
      selectSheet(parsed, 0);
      setStep("mapping");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fișierul nu a putut fi citit.");
    } finally {
      setBusy(false);
    }
  }

  function selectSheet(all: ParsedSheet[], index: number) {
    setSheetIndex(index);
    const rows = all[index]!.rows;
    const guessed = guessMapping(rows[0] ?? []);
    setMapping(guessed);
    const body = rows.slice(1);
    const distinct = (col: number | null) => (col === null ? [] : [...new Set(body.map((r) => (r[col] ?? "").trim()))]);
    setStatusMap(
      Object.fromEntries(
        distinct(guessed.status).map((v) => [v, (v && statuses.find((s) => fold(s.name) === fold(v))?.id) || defaultStatus.id]),
      ),
    );
    setSourceMap(
      Object.fromEntries(distinct(guessed.source).map((v) => [v, (v && sources.find((s) => fold(s.name) === fold(v))?.id) || ""])),
    );
  }

  function setColumn(field: TargetField, value: string) {
    const column = value === SKIP ? null : Number(value);
    setMapping((m) => ({ ...m, [field]: column }));
    if (field === "status") setStatusMap(autoStatusMap(column));
    if (field === "source") setSourceMap(autoSourceMap(column));
  }

  async function buildPreview() {
    setBusy(true);
    try {
      const cell = (row: string[], field: TargetField) => {
        const col = mapping[field];
        const value = col === null || col === undefined ? "" : (row[col] ?? "").trim();
        return value || null;
      };
      const phone = (value: string | null) => (value && normalizePhones ? cleanPhone(value) : value);

      const rows: PreviewRow[] = dataRows.map((r, i) => {
        const rawStatus = cell(r, "status") ?? "";
        const rawSource = cell(r, "source") ?? "";
        const mappedSource = mapping.source !== null ? sourceMap[rawSource] : "";
        const sourceId = mappedSource || (defaultSource === NO_SOURCE ? null : defaultSource);
        const rawDate = cell(r, "follow_up_date");
        return {
          row: i + 2,
          values: {
            company_name: cell(r, "company_name") ?? "",
            website: cell(r, "website"),
            owner_name: cell(r, "owner_name"),
            email: cell(r, "email"),
            phone1: phone(cell(r, "phone1")),
            phone2: phone(cell(r, "phone2")),
            status_id: mapping.status !== null ? (statusMap[rawStatus] ?? defaultStatus.id) : defaultStatus.id,
            source_id: sourceId,
            called_by: cell(r, "called_by"),
            follow_up_date: rawDate ? parseDateRO(rawDate) : null,
            follow_up_time: null,
            potential: cell(r, "potential"),
            notes: cell(r, "notes"),
          },
          problem: null,
          included: true,
        };
      });

      // Verificare față de baza de date, pe loturi.
      const seen = { domains: new Map<string, number>(), phones: new Map<string, number>(), emails: new Map<string, number>() };
      for (let start = 0; start < rows.length; start += 500) {
        const slice = rows.slice(start, start + 500);
        const result = await checkDuplicates(slice.map((r) => r.values));
        if (!result.ok) throw new Error(result.error);
        result.data.forEach((check, j) => {
          const row = slice[j]!;
          if (!row.values.company_name) {
            row.problem = { kind: "missing", text: "Lipsește numele companiei" };
            row.included = false;
            return;
          }
          if (check.match) {
            row.problem = { kind: "db", text: `Există deja: ${check.match.company_name} (${MATCHED_ON_LABEL[check.match.matched_on]})` };
            row.included = false;
            return;
          }
          // Duplicate în interiorul fișierului (față de un rând anterior).
          const earlier =
            check.domains.map((d) => seen.domains.get(d)).find(Boolean) ??
            check.phones.map((p) => seen.phones.get(p)).find(Boolean) ??
            (check.email ? seen.emails.get(check.email) : undefined);
          if (earlier) {
            row.problem = { kind: "file", text: `Duplicat în fișier cu rândul ${earlier}` };
            row.included = false;
            return;
          }
          check.domains.forEach((d) => seen.domains.set(d, row.row));
          check.phones.forEach((p) => seen.phones.set(p, row.row));
          if (check.email) seen.emails.set(check.email, row.row);
        });
      }
      setPreview(rows);
      setOnlyProblems(false);
      setStep("preview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Previzualizarea a eșuat.");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    const included = preview.filter((r) => r.included);
    const flaggedSkipped = preview.filter((r) => !r.included && (r.problem?.kind === "db" || r.problem?.kind === "file")).length;
    const manual = preview.filter((r) => !r.included && !r.problem).length;
    setStep("importing");
    setProgress(0);

    const started = await startImport(fileName, preview.length, {
      sheet: sheet?.name,
      mapping,
      statusMap,
      sourceMap,
      defaultSource,
      normalizePhones,
    });
    if (!started.ok) {
      toast.error(started.error);
      setStep("preview");
      return;
    }

    const total: Report = { imported: 0, duplicates: flaggedSkipped, manual, errors: [] };
    for (let start = 0; start < included.length; start += CHUNK) {
      const chunk = included.slice(start, start + CHUNK);
      const result = await importLeadsChunk(
        started.data,
        chunk.map((r) => ({ row: r.row, values: { ...r.values, force: r.problem !== null } })),
      );
      if (!result.ok) {
        total.errors.push(...chunk.map((r) => ({ row: r.row, error: result.error })));
      } else {
        total.imported += result.data.imported;
        total.duplicates += result.data.duplicates;
        total.errors.push(...result.data.errors);
      }
      setProgress(Math.min(1, (start + chunk.length) / included.length));
    }

    await finishImport(started.data, {
      imported: total.imported,
      skipped_duplicates: total.duplicates,
      skipped_manual: total.manual,
      errors: total.errors,
    });
    setReport(total);
    setStep("done");
    router.refresh();
  }

  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------

  if (step === "upload") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-card/60 px-6 py-16 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <FileSpreadsheetIcon className="size-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Trage aici fișierul sau alege-l de pe calculator</p>
          <p className="mt-1 text-sm text-muted-foreground">
            CSV sau Excel (.xlsx). Prima linie trebuie să fie antetul cu numele coloanelor.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
          Alege fișierul
        </Button>
      </div>
    );
  }

  if (step === "mapping") {
    const statusValues = Object.keys(statusMap).sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b, "ro")));
    const sourceValues = Object.keys(sourceMap).sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b, "ro")));
    const countFor = (column: number | null, value: string) =>
      column === null ? 0 : dataRows.filter((r) => (r[column] ?? "").trim() === value).length;

    return (
      <div className="grid gap-6">
        <StepIntro
          title="1. Potrivește coloanele"
          description={`${fileName} · ${dataRows.length} rânduri. Alege ce coloană din fișier merge în fiecare câmp.`}
          onBack={() => setStep("upload")}
        />

        {sheets.length > 1 ? (
          <div className="grid max-w-xs gap-1.5">
            <Label>Foaie (sheet)</Label>
            <Select value={String(sheetIndex)} onValueChange={(v) => selectSheet(sheets, Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sheets.map((s, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {s.name} ({s.rows.length - 1} rânduri)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Câmp în CRM</th>
                <th className="px-3 py-2 text-left font-medium">Coloană din fișier</th>
                <th className="hidden px-3 py-2 text-left font-medium md:table-cell">Exemplu</th>
              </tr>
            </thead>
            <tbody>
              {TARGET_FIELDS.map((field) => {
                const column = mapping[field.key];
                const example =
                  column !== null && column !== undefined ? dataRows.find((r) => (r[column] ?? "").trim())?.[column] : undefined;
                return (
                  <tr key={field.key} className="border-t">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {field.label}
                      {field.required ? <span className="text-destructive"> *</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={column === null || column === undefined ? SKIP : String(column)}
                        onValueChange={(v) => setColumn(field.key, v)}
                      >
                        <SelectTrigger size="sm" className="w-full max-w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP}>— nu importa —</SelectItem>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {h || `Coloana ${i + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="hidden max-w-80 truncate px-3 py-2 text-muted-foreground md:table-cell" title={example}>
                      {example ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {mapping.status !== null ? (
          <div className="grid gap-3">
            <div>
              <h3 className="text-base font-semibold">2. Potrivește statusurile</h3>
              <p className="text-sm text-muted-foreground">Fiecare valoare din coloana de status devine unul dintre statusurile tale.</p>
            </div>
            <div className="surface divide-y">
              {statusValues.map((value) => {
                const auto = value && statuses.some((s) => fold(s.name) === fold(value));
                return (
                  <div key={value} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                    <span className="text-sm">
                      {value ? <b>{value}</b> : <i className="text-muted-foreground">(gol)</i>}
                      <span className="ml-2 text-xs text-muted-foreground">{countFor(mapping.status, value)} rânduri</span>
                      {!auto && value ? <span className="ml-2 text-xs text-warning">nu există, alege</span> : null}
                    </span>
                    <Select value={statusMap[value]} onValueChange={(v) => setStatusMap((m) => ({ ...m, [value]: v }))}>
                      <SelectTrigger size="sm" className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Lipsește un status? Îl poți adăuga din{" "}
              <Link href="/setari/lead-uri" className="underline underline-offset-4" target="_blank">
                Setări → Lead-uri
              </Link>{" "}
              și reîncarci fișierul.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3">
          <div>
            <h3 className="text-base font-semibold">{mapping.status !== null ? "3" : "2"}. Sursă și opțiuni</h3>
          </div>
          {mapping.source !== null ? (
            <div className="surface divide-y">
              {sourceValues.map((value) => (
                <div key={value} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm">
                    {value ? <b>{value}</b> : <i className="text-muted-foreground">(gol)</i>}
                    <span className="ml-2 text-xs text-muted-foreground">{countFor(mapping.source, value)} rânduri</span>
                  </span>
                  <Select
                    value={sourceMap[value] || NO_SOURCE}
                    onValueChange={(v) => setSourceMap((m) => ({ ...m, [value]: v === NO_SOURCE ? "" : v }))}
                  >
                    <SelectTrigger size="sm" className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SOURCE}>Sursa implicită (mai jos)</SelectItem>
                      {sources.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-6">
            <div className="grid gap-1.5">
              <Label>{mapping.source !== null ? "Sursă implicită (pentru valori goale)" : "Sursa pentru toate lead-urile"}</Label>
              <Select value={defaultSource} onValueChange={setDefaultSource}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources
                    .filter((s) => s.active)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  <SelectItem value={NO_SOURCE}>Fără sursă</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex h-9 items-center gap-2 text-sm">
              <Checkbox checked={normalizePhones} onCheckedChange={(v) => setNormalizePhones(v === true)} />
              Curăță telefoanele (40726754999 → 0726754999)
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={buildPreview} disabled={busy || mapping.company_name === null}>
            {busy ? <Loader2Icon className="animate-spin" /> : null}
            Previzualizare și verificare duplicate
          </Button>
          {mapping.company_name === null ? (
            <span className="self-center text-sm text-destructive">Alege coloana pentru „Nume companie”.</span>
          ) : null}
        </div>
      </div>
    );
  }

  if (step === "preview") {
    const included = preview.filter((r) => r.included).length;
    const dbDup = preview.filter((r) => r.problem?.kind === "db").length;
    const fileDup = preview.filter((r) => r.problem?.kind === "file").length;
    const missing = preview.filter((r) => r.problem?.kind === "missing").length;
    const visible = onlyProblems ? preview.filter((r) => r.problem) : preview;
    const toggle = (row: number, value: boolean) => setPreview((rows) => rows.map((r) => (r.row === row ? { ...r, included: value } : r)));
    const allVisibleIncluded = visible.filter((r) => r.problem?.kind !== "missing").every((r) => r.included);

    return (
      <div className="grid gap-4">
        <StepIntro
          title="Previzualizare"
          description="Duplicatele sunt debifate. Le poți bifa dacă vrei totuși să le imporți, sau poți debifa rânduri pe care nu le vrei."
          onBack={() => setStep("mapping")}
        />
        <div className="flex flex-wrap gap-2 text-sm">
          <Stat label="de importat" value={included} tone="good" />
          <Stat label="există deja în CRM" value={dbDup} tone={dbDup ? "warn" : undefined} />
          <Stat label="duplicate în fișier" value={fileDup} tone={fileDup ? "warn" : undefined} />
          {missing ? <Stat label="fără nume (sărite)" value={missing} tone="bad" /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyProblems} onCheckedChange={(v) => setOnlyProblems(v === true)} />
            Arată doar rândurile cu probleme
          </label>
          <div className="flex-1" />
          <Button onClick={runImport} disabled={included === 0}>
            Importă {included} {included === 1 ? "lead" : "lead-uri"}
          </Button>
        </div>
        <div className="surface overflow-hidden">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="table-head sticky top-0 z-10 bg-muted">
                <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium [&>th]:whitespace-nowrap">
                  <th className="w-8">
                    <Checkbox
                      checked={allVisibleIncluded}
                      onCheckedChange={(v) => {
                        const ids = new Set(visible.filter((r) => r.problem?.kind !== "missing").map((r) => r.row));
                        setPreview((rows) => rows.map((r) => (ids.has(r.row) ? { ...r, included: v === true } : r)));
                      }}
                      aria-label="Selectează tot"
                    />
                  </th>
                  <th>Rând</th>
                  <th>Companie</th>
                  <th>Website</th>
                  <th>Telefon</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Follow-up</th>
                  <th>Problemă</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const status = statusById.get(r.values.status_id);
                  return (
                    <tr key={r.row} className={cn("border-t [&>td]:px-2 [&>td]:py-1.5", !r.included && "text-muted-foreground")}>
                      <td>
                        <Checkbox
                          checked={r.included}
                          disabled={r.problem?.kind === "missing"}
                          onCheckedChange={(v) => toggle(r.row, v === true)}
                          aria-label={`Include rândul ${r.row}`}
                        />
                      </td>
                      <td className="tabular-nums">{r.row}</td>
                      <td className="max-w-56 truncate font-medium">{r.values.company_name || "—"}</td>
                      <td className="max-w-44 truncate">{r.values.website}</td>
                      <td className="whitespace-nowrap tabular-nums">{formatPhone(r.values.phone1)}</td>
                      <td className="max-w-48 truncate">{r.values.email}</td>
                      <td>{status ? <ColorBadge color={status.color}>{status.name}</ColorBadge> : null}</td>
                      <td className="tabular-nums">{formatDate(r.values.follow_up_date)}</td>
                      <td className="min-w-64">
                        {r.problem ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-xs",
                              r.problem.kind === "missing" ? "text-destructive" : "text-warning",
                            )}
                          >
                            <AlertTriangleIcon className="size-3.5 shrink-0" />
                            <span>{r.problem.text}</span>
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Loader2Icon className="size-8 animate-spin text-brand" />
        <p className="font-medium">Se importă… {Math.round(progress * 100)}%</p>
        <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-brand transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="grid max-w-2xl gap-5">
      <div className="flex items-center gap-3">
        <CheckCircle2Icon className="size-8 text-brand-strong" />
        <div>
          <h2 className="text-xl font-semibold">Import finalizat</h2>
          <p className="text-sm text-muted-foreground">{fileName}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Stat label="importate" value={report?.imported ?? 0} tone="good" />
        <Stat label="duplicate sărite" value={report?.duplicates ?? 0} tone={report?.duplicates ? "warn" : undefined} />
        <Stat label="excluse manual" value={report?.manual ?? 0} />
        <Stat label="erori" value={report?.errors.length ?? 0} tone={report?.errors.length ? "bad" : undefined} />
      </div>
      {report?.errors.length ? (
        <div className="surface max-h-60 overflow-auto p-3 text-sm">
          {report.errors.map((e, i) => (
            <p key={i}>
              <span className="text-muted-foreground">Rândul {e.row}:</span> {e.error}
            </p>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/leaduri">Vezi lead-urile</Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setReport(null);
            setPreview([]);
            setSheets([]);
            setStep("upload");
          }}
        >
          Alt import
        </Button>
      </div>
    </div>
  );
}

function StepIntro({ title, description, onBack }: { title: string; description: string; onBack: () => void }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onBack}>
        Înapoi
      </Button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-lg border px-3 py-1.5",
        tone === "good" && "border-brand/40 bg-accent",
        tone === "warn" && "border-warning/40 bg-warning-soft",
        tone === "bad" && "border-destructive/40 bg-danger-soft",
      )}
    >
      <b className="text-base tabular-nums">{value}</b> {label}
    </span>
  );
}
