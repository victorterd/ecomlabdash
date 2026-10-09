export type ProjectType = "proiect" | "retainer";

export type Project = {
  id: string;
  lead_id: string | null;
  client_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  description: string | null;
  type: ProjectType;
  start_date: string | null;
  deadline: string | null;
  current_stage_id: string | null;
  board_position: number;
  notes: string | null;
  archived: boolean;
  is_seed: boolean;
  created_at: string;
  updated_at: string;
};

export const PROJECT_COLUMNS =
  "id, lead_id, client_name, contact_name, contact_email, contact_phone, website, description, type, start_date, deadline, current_stage_id, board_position, notes, archived, is_seed, created_at, updated_at";

export type ProjectFinance = {
  project_id: string;
  contract_value: string;
  commission_enabled: boolean;
  setter_commission_pct: string;
  setter_name: string | null;
  retainer_monthly_amount: string | null;
  retainer_start_month: string | null;
  retainer_end_month: string | null;
};

export type StageDeadline = {
  id: string;
  project_id: string;
  stage_id: string;
  planned_date: string | null;
  completed_date: string | null;
};

export type TxType = "income" | "expense";
export type TxStatus = "planned" | "realized";
export type TxKind = "manual" | "installment" | "project_cost" | "commission" | "recurring";

export type Transaction = {
  id: string;
  type: TxType;
  amount: string;
  status: TxStatus;
  due_date: string;
  realized_date: string | null;
  effective_date: string;
  category_id: string | null;
  scope: "business" | "personal";
  project_id: string | null;
  kind: TxKind;
  cost_type_id: string | null;
  person: string | null;
  actor_id: string | null;
  description: string | null;
  manual_override: boolean;
  is_seed: boolean;
};

export const TX_COLUMNS =
  "id, type, amount, status, due_date, realized_date, effective_date, category_id, scope, project_id, kind, cost_type_id, person, actor_id, description, manual_override, is_seed";

export type Actor = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  rate: string | null;
  rate_unit: "clip" | "zi" | "proiect";
  rating: number | null;
  notes: string | null;
  active: boolean;
  is_seed: boolean;
};

export const ACTOR_COLUMNS = "id, name, phone, email, instagram, rate, rate_unit, rating, notes, active, is_seed";

export type ProjectActor = {
  id: string;
  project_id: string;
  actor_id: string;
  role_notes: string | null;
  agreed_fee: string | null;
};

export type Shoot = {
  id: string;
  project_id: string | null;
  shoot_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  is_seed: boolean;
  actor_ids: string[];
};

export const RATE_UNIT_LABEL: Record<Actor["rate_unit"], string> = { clip: "/ clip", zi: "/ zi", proiect: "/ proiect" };
export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = { proiect: "Proiect", retainer: "Retainer" };
