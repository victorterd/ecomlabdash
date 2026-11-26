-- =====================================================================
-- Ecomlab CRM — Forecast pe model P&L (ca în Excel-ul „Proiecție PnL”)
--
-- Pe fiecare lună:
--   • forecast_projects    : proiecte estimate — venituri + costuri directe (actor, cameraman, editor);
--   • forecast_fixed_costs : costuri fixe (contabilitate, abonamente, advertising…), cu denumire și sumă.
-- Profit brut = venituri − costuri directe; profit net = profit brut − costuri fixe.
--
-- Estimările vechi (forecast_entries) se mută aici: venitul lunii devine un proiect „Venituri estimate”,
-- cheltuielile pe categorii devin costuri fixe cu numele categoriei.
-- Scriptul se poate rula de mai multe ori.
-- =====================================================================

create table if not exists public.forecast_projects (
  id          uuid primary key default gen_random_uuid(),
  month       date not null check (extract(day from month) = 1),
  name        text not null default '',
  revenue     numeric(14, 2) not null default 0 check (revenue >= 0),
  actor       numeric(14, 2) not null default 0 check (actor >= 0),
  cameraman   numeric(14, 2) not null default 0 check (cameraman >= 0),
  editor      numeric(14, 2) not null default 0 check (editor >= 0),
  sort_order  double precision not null default 0,
  is_seed     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists forecast_projects_month_idx on public.forecast_projects (month, sort_order);

create table if not exists public.forecast_fixed_costs (
  id          uuid primary key default gen_random_uuid(),
  month       date not null check (extract(day from month) = 1),
  name        text not null default '',
  amount      numeric(14, 2) not null default 0 check (amount >= 0),
  sort_order  double precision not null default 0,
  is_seed     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists forecast_fixed_costs_month_idx on public.forecast_fixed_costs (month, sort_order);

alter table public.forecast_projects    enable row level security;
alter table public.forecast_fixed_costs enable row level security;

drop policy if exists forecast_projects_admin on public.forecast_projects;
create policy forecast_projects_admin on public.forecast_projects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists forecast_fixed_costs_admin on public.forecast_fixed_costs;
create policy forecast_fixed_costs_admin on public.forecast_fixed_costs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Estimările vechi → modelul nou (doar pentru lunile care nu au încă nimic în modelul nou).
insert into public.forecast_projects (month, name, revenue, is_seed)
select f.month, 'Venituri estimate', f.amount, f.is_seed
from public.forecast_entries f
where f.type = 'income' and f.amount > 0
  and not exists (select 1 from public.forecast_projects p where p.month = f.month);

insert into public.forecast_fixed_costs (month, name, amount, sort_order, is_seed)
select f.month, coalesce(cat.name, 'Cheltuieli'), f.amount, coalesce(cat.sort_order, 0), f.is_seed
from public.forecast_entries f
left join public.expense_categories cat on cat.id = f.category_id
where f.type = 'expense' and f.amount > 0
  and not exists (select 1 from public.forecast_fixed_costs c where c.month = f.month);

-- Estimările vechi au fost mutate; le golim ca să nu se mai mute încă o dată.
delete from public.forecast_entries;
