import Papa from "papaparse";
import { formatDate, formatDateTime, formatTime, todayISO } from "@/lib/format";
import type { Lead } from "@/lib/leads/types";
import type { LeadSource, LeadStatus } from "@/lib/types";

/** Descarcă lead-urile date ca CSV (UTF-8 cu BOM, ca diacriticele să apară corect în Excel). */
export function exportLeadsCsv(leads: Lead[], statusById: Map<string, LeadStatus>, sourceById: Map<string, LeadSource>) {
  const csv = Papa.unparse(
    leads.map((l) => ({
      "Nume companie": l.company_name,
      Website: l.website ?? "",
      Owner: l.owner_name ?? "",
      Email: l.email ?? "",
      "Telefon 1": l.phone1 ?? "",
      "Telefon 2": l.phone2 ?? "",
      Status: statusById.get(l.status_id)?.name ?? "",
      Sursă: l.source_id ? (sourceById.get(l.source_id)?.name ?? "") : "",
      "Cine l-a sunat": l.called_by ?? "",
      "Dată follow-up": formatDate(l.follow_up_date),
      "Ora follow-up": formatTime(l.follow_up_time),
      Potențial: l.potential ?? "",
      Informații: l.notes ?? "",
      "Creat la": formatDateTime(l.created_at),
      "Modificat la": formatDateTime(l.updated_at),
    })),
  );
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leaduri-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
