import { fold } from "@/lib/leads/normalize";

export type TargetField =
  | "company_name"
  | "website"
  | "owner_name"
  | "email"
  | "phone1"
  | "phone2"
  | "status"
  | "source"
  | "called_by"
  | "follow_up_date"
  | "potential"
  | "notes";

export const TARGET_FIELDS: { key: TargetField; label: string; required?: boolean; synonyms: string[] }[] = [
  {
    key: "company_name",
    label: "Nume companie",
    required: true,
    synonyms: ["nume companie", "companie", "firma", "company", "denumire", "nume firma", "nume"],
  },
  { key: "website", label: "Website", synonyms: ["website", "site", "web", "url", "magazin"] },
  { key: "owner_name", label: "Owner (contact)", synonyms: ["owner", "contact", "persoana de contact", "administrator", "proprietar"] },
  { key: "email", label: "Email", synonyms: ["email", "e-mail", "mail"] },
  { key: "phone1", label: "Telefon 1", synonyms: ["telefon 1", "telefon", "phone", "tel", "telefon1", "mobil"] },
  { key: "phone2", label: "Telefon 2", synonyms: ["telefon 2", "phone 2", "telefon2", "tel 2"] },
  { key: "status", label: "Status", synonyms: ["status", "stare"] },
  { key: "source", label: "Sursă", synonyms: ["sursa", "source"] },
  { key: "called_by", label: "Cine l-a sunat", synonyms: ["cine l-a sunat", "sunat de", "setter", "agent"] },
  { key: "follow_up_date", label: "Dată follow-up", synonyms: ["data follow-up", "data follow up", "follow-up", "follow up", "followup"] },
  { key: "potential", label: "Potențial", synonyms: ["potential", "calificare"] },
  { key: "notes", label: "Informații", synonyms: ["informatii", "notite", "note", "observatii", "info", "comentarii", "detalii"] },
];

/** Ghicește coloana pentru fiecare câmp după numele din antet. */
export function guessMapping(headers: string[]): Record<TargetField, number | null> {
  const folded = headers.map(fold);
  const used = new Set<number>();
  const mapping = {} as Record<TargetField, number | null>;
  // Întâi potrivirile exacte, apoi cele parțiale.
  for (const pass of ["exact", "partial"] as const) {
    for (const field of TARGET_FIELDS) {
      if (mapping[field.key] !== undefined && mapping[field.key] !== null) continue;
      const index = folded.findIndex((h, i) => !used.has(i) && field.synonyms.some((s) => (pass === "exact" ? h === s : h.includes(s))));
      mapping[field.key] = index >= 0 ? index : null;
      if (index >= 0) used.add(index);
    }
  }
  return mapping;
}
