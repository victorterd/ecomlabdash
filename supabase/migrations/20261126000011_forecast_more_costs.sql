-- =====================================================================
-- Ecomlab CRM — Forecast: costuri directe noi pe proiect
-- Pe lângă actor, cameraman și editor: scripter și agent vânzări.
-- Scriptul se poate rula de mai multe ori.
-- =====================================================================

alter table public.forecast_projects
  add column if not exists scripter    numeric(14, 2) not null default 0 check (scripter >= 0),
  add column if not exists sales_agent numeric(14, 2) not null default 0 check (sales_agent >= 0);
