import { TZDate } from "@date-fns/tz";
import { format, isValid, parse } from "date-fns";
import Decimal from "decimal.js";

export const TIMEZONE = "Europe/Bucharest";

const ronFormatter = new Intl.NumberFormat("ro-RO", {
  style: "currency",
  currency: "RON",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Sumele vin din Postgres ca string (numeric) — nu le trecem prin float la calcule. */
export type Money = string | number | Decimal | null | undefined;

export function toDecimal(value: Money): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  return new Decimal(value);
}

/** 12345.5 → „12.345,50 RON” */
export function formatRON(value: Money): string {
  return ronFormatter.format(toDecimal(value).toNumber());
}

export function formatNumber(value: Money): string {
  return numberFormatter.format(toDecimal(value).toNumber());
}

export function formatPercent(value: Money): string {
  return `${numberFormatter.format(toDecimal(value).toNumber())}%`;
}

/** „Acum” în fusul orar al României. */
export function nowRO(): TZDate {
  return new TZDate(Date.now(), TIMEZONE);
}

/** Data de azi în România, ca ISO „aaaa-ll-zz” (formatul coloanelor `date`). */
export function todayISO(): string {
  return format(nowRO(), "yyyy-MM-dd");
}

function parseISODate(iso: string): Date {
  return parse(iso.slice(0, 10), "yyyy-MM-dd", new Date());
}

/** „2026-10-09” → „09.10.2026” */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseISODate(iso);
  return isValid(d) ? format(d, "dd.MM.yyyy") : "";
}

/** Timestamp → „09.10.2026 14:05” în ora României. */
export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return "";
  return format(new TZDate(ts, TIMEZONE), "dd.MM.yyyy HH:mm");
}

/** „09.10.2026” (sau „9.10.2026”) → „2026-10-09”; null dacă nu e validă. */
export function parseDateRO(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  for (const pattern of ["dd.MM.yyyy", "d.M.yyyy", "dd.MM.yy", "yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy"]) {
    const d = parse(trimmed, pattern, new Date());
    if (isValid(d) && d.getFullYear() > 1900) return format(d, "yyyy-MM-dd");
  }
  return null;
}

/** „10:00:00” → „10:00” */
export function formatTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

/**
 * Interpretează o sumă scrisă „românește”: „12.500,50”, „12500,5”, „12 500” sau „12500.50”.
 * Întoarce un string zecimal pentru Postgres („12500.50”) sau null dacă nu e valid.
 */
export function parseMoneyInput(value: string): string | null {
  const cleaned = value
    .trim()
    .replace(/\s|RON|lei/gi, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return new Decimal(cleaned).toFixed(2);
}

/** „9”, „930”, „9:30”, „09.30” → „09:30”; „” → null; invalid → undefined. */
export function parseTimeInput(value: string): string | null | undefined {
  const raw = value.trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})(?:[:.]?(\d{2}))?$/);
  if (!match) return undefined;
  const h = Number(match[1]);
  const m = match[2] ? Number(match[2]) : 0;
  if (h > 23 || m > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const amountFormatter = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Sumă fără „RON” (pentru tabele cu multe coloane): 12345.5 → „12.345,50”. */
export function formatAmount(value: Money): string {
  return amountFormatter.format(toDecimal(value).toNumber());
}
