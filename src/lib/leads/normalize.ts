/**
 * Aceleași reguli ca funcțiile SQL normalize_domain / normalize_phone / normalize_email
 * (migrația 20261010000002_leads.sql). Folosite în browser pentru duplicatele din
 * interiorul unui fișier de import; verificarea față de baza de date se face în SQL.
 */

export function normalizeDomain(value: string): string | null {
  const d = value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\.|[/?#:].*$/g, "");
  return d.includes(".") ? d : null;
}

export function leadDomains(value: string | null | undefined): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(/[,;\s]+/)
        .map(normalizeDomain)
        .filter((d): d is string => Boolean(d)),
    ),
  ];
}

export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  let n = digits;
  if (digits.startsWith("0040")) n = `0${digits.slice(4)}`;
  else if (digits.startsWith("40") && digits.length === 11) n = `0${digits.slice(2)}`;
  return n.length < 6 ? null : n;
}

export function leadPhones(...values: (string | null | undefined)[]): string[] {
  const parts = values.flatMap((v) => (v ? v.split(/[,;/]+/) : []));
  return [...new Set(parts.map(normalizePhone).filter((p): p is string => Boolean(p)))];
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const e = (value ?? "").trim().toLowerCase();
  return e || null;
}

/** Curăță un telefon pentru salvare: „40726754999” → „0726754999”; păstrează textul dacă nu e un număr. */
export function cleanPhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/[,;/]+/).map((p) => p.trim());
  return parts.map((p) => normalizePhone(p) ?? p).join(", ");
}

/** „0726754999” → „0726 754 999” pentru afișare. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .split(/,\s*/)
    .map((p) => (/^0\d{9}$/.test(p) ? `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : p))
    .join(", ");
}

/** Prima adresă dintr-un câmp website, ca link clicabil. */
export function websiteHref(value: string | null | undefined): string | null {
  const first = (value ?? "").split(/[,;\s]+/).find(Boolean);
  if (!first) return null;
  return /^https?:\/\//i.test(first) ? first : `https://${first}`;
}

export function websiteLabel(value: string | null | undefined): string {
  const domains = leadDomains(value);
  if (!domains.length) return value ?? "";
  return domains.length > 1 ? `${domains[0]} +${domains.length - 1}` : domains[0]!;
}

/** Text fără diacritice, lowercase — pentru căutare și potrivirea coloanelor la import. */
export function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
