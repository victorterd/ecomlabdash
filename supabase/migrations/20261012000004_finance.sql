-- =====================================================================
-- Ecomlab CRM — Etapa 4: cheltuieli recurente, forecast
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cheltuieli recurente lunare (ex. contabilitatea)
-- ---------------------------------------------------------------------

create table public.recurring_expenses (
  id            uuid primary key default gen_random_uuid(),
  description   text not null check (length(trim(description)) > 0),
  amount        numeric(14, 2) not null check (amount > 0),
  category_id   uuid references public.expense_categories (id) on delete set null,
  scope         public.tx_scope not null default 'business',
  day_of_month  smallint not null default 1 check (day_of_month between 1 and 31),
  start_month   date not null,          -- prima zi a lunii de început
  end_month     date,                   -- ultima lună inclusă (null = fără sfârșit)
  active        boolean not null default true,
  is_seed       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger recurring_expenses_updated_at before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

alter table public.transactions
  add column recurring_rule_id uuid references public.recurring_expenses (id) on delete set null,
  add column period_month date;

create unique index transactions_recurring_month on public.transactions (recurring_rule_id, period_month)
  where recurring_rule_id is not null;

-- Generează (idempotent) cheltuielile planificate pentru următoarele N luni,
-- începând cu luna curentă. Regulile modificate își regenerează lunile viitoare
-- încă neplătite (vezi refresh_recurring_rule).
create or replace function public.generate_recurring_transactions(p_months int default 12)
returns int
language plpgsql
as $$
declare
  first_month date := date_trunc('month', public.today_ro())::date;
  inserted int;
begin
  insert into public.transactions (type, amount, status, due_date, category_id, scope, kind, recurring_rule_id, period_month, description, is_seed)
  select
    'expense',
    r.amount,
    'planned',
    m.month + (least(r.day_of_month, extract(day from (m.month + interval '1 month - 1 day'))::int) - 1),
    r.category_id,
    r.scope,
    'recurring',
    r.id,
    m.month,
    r.description,
    r.is_seed
  from public.recurring_expenses r
  cross join lateral (
    select gs::date as month
    from generate_series(greatest(date_trunc('month', r.start_month)::date, first_month),
                         first_month + make_interval(months => p_months - 1),
                         interval '1 month') gs
  ) m
  where r.active
    and (r.end_month is null or m.month <= date_trunc('month', r.end_month)::date)
  on conflict (recurring_rule_id, period_month) where recurring_rule_id is not null do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- După modificarea/dezactivarea unei reguli: șterge lunile viitoare încă planificate
-- și le regenerează cu valorile noi. Lunile plătite rămân neatinse.
create or replace function public.refresh_recurring_rule(p_rule_id uuid)
returns void
language plpgsql
as $$
begin
  delete from public.transactions
  where recurring_rule_id = p_rule_id
    and status = 'planned'
    and period_month >= date_trunc('month', public.today_ro())::date;
  perform public.generate_recurring_transactions(12);
end;
$$;

-- ---------------------------------------------------------------------
-- Forecast (introdus manual, pe lună)
-- ---------------------------------------------------------------------

create table public.forecast_entries (
  id           uuid primary key default gen_random_uuid(),
  month        date not null check (extract(day from month) = 1),
  type         public.tx_type not null,
  category_id  uuid references public.expense_categories (id) on delete cascade,
  amount       numeric(14, 2) not null default 0 check (amount >= 0),
  is_seed      boolean not null default false,
  updated_at   timestamptz not null default now()
);

-- O singură valoare pe lună / tip / categorie (veniturile n-au categorie).
alter table public.forecast_entries
  add constraint forecast_entries_key unique nulls not distinct (month, type, category_id);

create trigger forecast_entries_updated_at before update on public.forecast_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: doar admin
-- ---------------------------------------------------------------------

alter table public.recurring_expenses enable row level security;
alter table public.forecast_entries   enable row level security;

create policy recurring_expenses_admin on public.recurring_expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy forecast_entries_admin on public.forecast_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
