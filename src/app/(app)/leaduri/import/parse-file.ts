import Papa from "papaparse";
import { format } from "date-fns";

export type ParsedSheet = { name: string; rows: string[][] };

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return format(value, "yyyy-MM-dd");
  return String(value).trim();
}

/** CSV-urile exportate din Excel pe Windows sunt deseori în Windows-1250, nu UTF-8. */
function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1250").decode(buffer);
  }
}

export async function parseFile(file: File): Promise<ParsedSheet[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(file);
    return sheets.map((s) => ({ name: s.sheet, rows: s.data.map((row) => row.map(cellToString)) }));
  }

  if (name.endsWith(".xls")) {
    throw new Error("Formatul vechi .xls nu e suportat. Salvează fișierul ca .xlsx sau .csv și încearcă din nou.");
  }

  const text = decodeText(await file.arrayBuffer()).replace(/^﻿/, "");
  const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  if (result.errors.length && !result.data.length) throw new Error(result.errors[0]!.message);
  return [{ name: file.name, rows: result.data.map((row) => row.map(cellToString)) }];
}
