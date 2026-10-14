export type UserRole = "admin" | "setter" | "productie";
export type Theme = "light" | "dark" | "system";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  theme: Theme;
};

export type AppSettings = {
  follow_up_days: number;
  follow_up_default_time: string;
  deadline_warning_days: number;
  daily_email_time: string;
  timezone: string;
};

export type FinanceSettings = {
  setter_commission_pct: string;
  profit_tax_pct: string;
  dividend_tax_pct: string;
  opening_balance: string;
  opening_balance_date: string;
};

export type NotificationPrefs = {
  user_id: string;
  email_daily: boolean;
  push_enabled: boolean;
  notify_followups: boolean;
  notify_followup_at_time: boolean;
  notify_installments: boolean;
  notify_payments: boolean;
  notify_shoots: boolean;
  notify_stage_deadlines: boolean;
  email_to: string | null;
};

export type LeadStatus = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  is_follow_up: boolean;
  is_won: boolean;
  is_closed: boolean;
};

export type LeadSource = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  active: boolean;
};

export type CostType = {
  id: string;
  name: string;
  sort_order: number;
  default_category_id: string | null;
  is_commission: boolean;
  active: boolean;
};
