export type Lead = {
  id: string;
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
  follow_up_time: string | null;
  potential: string | null;
  notes: string | null;
  is_seed: boolean;
  created_at: string;
  updated_at: string;
};

export const LEAD_COLUMNS =
  "id, company_name, website, owner_name, email, phone1, phone2, status_id, source_id, called_by, follow_up_date, follow_up_time, potential, notes, is_seed, created_at, updated_at";

/** Câmpurile editabile ale unui lead. */
export type LeadInput = Partial<
  Pick<
    Lead,
    | "company_name"
    | "website"
    | "owner_name"
    | "email"
    | "phone1"
    | "phone2"
    | "status_id"
    | "source_id"
    | "called_by"
    | "follow_up_date"
    | "follow_up_time"
    | "potential"
    | "notes"
  >
>;

export type DuplicateMatch = {
  lead_id: string;
  company_name: string;
  matched_on: "website" | "email" | "telefon";
};

export type StatusHistoryEntry = {
  id: string;
  from_status_id: string | null;
  to_status_id: string | null;
  changed_at: string;
};

export const MATCHED_ON_LABEL: Record<DuplicateMatch["matched_on"], string> = {
  website: "același website",
  email: "același email",
  telefon: "același telefon",
};
