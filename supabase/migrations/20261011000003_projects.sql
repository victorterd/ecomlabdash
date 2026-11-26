-- =====================================================================
-- Ecomlab CRM — Etapa 3: proiecte, etape, actori, filmări, tranzacții
-- =====================================================================

-- ---------------------------------------------------------------------
-- Acces
-- ---------------------------------------------------------------------

-- Proiecte, actori, calendar: admin și producție.
create or replace function public.can_access_production()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('admin', 'productie') from public.profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------------
-- Actori UGC
-- ---------------------------------------------------------------------

create table public.actors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  phone       text,
  email       text,
  instagram   text,
  rate        numeric(14, 2) check (rate is null or rate >= 0),
  rate_unit   text not null default 'clip' check (rate_unit in ('clip', 'zi', 'proiect')),
  rating      smallint check (rating between 1 and 5),
  notes       text,
  active      boolean not null default true,
  is_seed     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger actors_updated_at before update on public.actors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Proiecte
-- ---------------------------------------------------------------------

create type public.project_type as enum ('proiect', 'retainer');

create table public.projects (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid references public.leads (id) on delete set null,
  client_name       text not null check (length(trim(client_name)) > 0),
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  website           text,
  description       text,
  type              public.project_type not null default 'proiect',
  start_date        date,
  deadline          date,
  current_stage_id  uuid references public.project_stages (id) on delete set null,
  board_position    double precision not null default 0,
  notes             text,
  archived          boolean not null default false,
  is_seed           boolean not null default false,
  created_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index projects_stage_idx on public.projects (current_stage_id, board_position);
create index projects_lead_idx on public.projects (lead_id);
create index projects_deadline_idx on public.projects (deadline) where not archived;

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- Partea financiară a proiectului — doar admin.
create table public.project_finance (
  project_id               uuid primary key references public.projects (id) on delete cascade,
  contract_value           numeric(14, 2) not null default 0 check (contract_value >= 0),
  commission_enabled       boolean not null default true,
  setter_commission_pct    numeric(5, 2) not null default 15 check (setter_commission_pct between 0 and 100),
  setter_name              text,
  retainer_monthly_amount  numeric(14, 2) check (retainer_monthly_amount is null or retainer_monthly_amount >= 0),
  retainer_start_month     date,
  retainer_end_month       date,
  updated_at               timestamptz not null default now()
);

create trigger project_finance_updated_at before update on public.project_finance
  for each row execute function public.set_updated_at();

-- Termen planificat și dată realizată pentru fiecare etapă.
create table public.project_stage_deadlines (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  stage_id        uuid not null references public.project_stages (id) on delete cascade,
  planned_date    date,
  completed_date  date,
  unique (project_id, stage_id)
);

create index project_stage_deadlines_planned_idx on public.project_stage_deadlines (planned_date) where completed_date is null;

-- La crearea proiectului: termene sugerate pentru fiecare etapă (start + N zile).
create or replace function public.projects_init_stages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_stage_deadlines (project_id, stage_id, planned_date)
  select new.id, s.id,
         case when new.start_date is not null and s.default_offset_days is not null
              then new.start_date + s.default_offset_days end
  from public.project_stages s
  on conflict (project_id, stage_id) do nothing;
  return null;
end;
$$;

create trigger projects_init_stages after insert on public.projects
  for each row execute function public.projects_init_stages();

-- La mutarea pe un stadiu nou: etapele anterioare nefinalizate primesc data de azi.
-- Stadiul final (Livrat) se marchează și el ca realizat.
create or replace function public.projects_stage_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order int;
  target_final boolean;
begin
  if new.current_stage_id is null or new.current_stage_id is not distinct from old.current_stage_id then
    return null;
  end if;

  select sort_order, is_final into target_order, target_final from public.project_stages where id = new.current_stage_id;

  insert into public.project_stage_deadlines (project_id, stage_id, completed_date)
  select new.id, s.id, public.today_ro()
  from public.project_stages s
  where s.sort_order < target_order or (target_final and s.id = new.current_stage_id)
  on conflict (project_id, stage_id) do update
    set completed_date = coalesce(project_stage_deadlines.completed_date, excluded.completed_date);
  return null;
end;
$$;

create trigger projects_stage_progress after update of current_stage_id on public.projects
  for each row execute function public.projects_stage_progress();

-- ---------------------------------------------------------------------
-- Actori pe proiect, filmări
-- ---------------------------------------------------------------------

create table public.project_actors (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  actor_id     uuid not null references public.actors (id) on delete cascade,
  role_notes   text,
  agreed_fee   numeric(14, 2) check (agreed_fee is null or agreed_fee >= 0),
  created_at   timestamptz not null default now(),
  unique (project_id, actor_id)
);

create index project_actors_actor_idx on public.project_actors (actor_id);

create table public.shoots (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete cascade,
  shoot_date  date not null,
  start_time  time,
  end_time    time,
  location    text,
  notes       text,
  is_seed     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index shoots_date_idx on public.shoots (shoot_date);

create trigger shoots_updated_at before update on public.shoots
  for each row execute function public.set_updated_at();

create table public.shoot_actors (
  shoot_id  uuid not null references public.shoots (id) on delete cascade,
  actor_id  uuid not null references public.actors (id) on delete cascade,
  primary key (shoot_id, actor_id)
);

-- ---------------------------------------------------------------------
-- Tranzacții (cashflow) — sursa unică pentru bani
-- ---------------------------------------------------------------------

create type public.tx_type   as enum ('income', 'expense');
create type public.tx_status as enum ('planned', 'realized');
create type public.tx_scope  as enum ('business', 'personal');
create type public.tx_kind   as enum ('manual', 'installment', 'project_cost', 'commission', 'recurring');

create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  type             public.tx_type not null,
  amount           numeric(14, 2) not null check (amount > 0),
  status           public.tx_status not null default 'planned',
  due_date         date not null,                 -- data planificată / scadentă
  realized_date    date,                          -- data efectivă
  category_id      uuid references public.expense_categories (id) on delete set null,
  scope            public.tx_scope not null default 'business',
  project_id       uuid references public.projects (id) on delete cascade,
  kind             public.tx_kind not null default 'manual',
  cost_type_id     uuid references public.cost_types (id) on delete set null,
  person           text,
  actor_id         uuid references public.actors (id) on delete set null,
  description      text,
  manual_override  boolean not null default false,  -- comision editat de mână: nu se mai recalculează
  is_seed          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint transactions_realized_date check (status = 'planned' or realized_date is not null)
);

-- Data folosită în cashflow: data efectivă dacă e realizată, altfel scadența.
alter table public.transactions
  add column effective_date date generated always as (coalesce(realized_date, due_date)) stored;

create index transactions_effective_idx on public.transactions (effective_date);
create index transactions_project_idx on public.transactions (project_id);
create unique index transactions_one_commission on public.transactions (project_id) where kind = 'commission';

create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Comision setter automat
-- ---------------------------------------------------------------------
-- Cheltuială planificată = valoare contract × procent, la data primei tranșe
-- (sau data de start a proiectului / azi). Se recalculează cât timp e
-- planificată și nu a fost editată manual.

create or replace function public.sync_project_commission(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fin        public.project_finance%rowtype;
  v_existing   public.transactions%rowtype;
  v_amount     numeric(14, 2);
  v_due        date;
  v_cost_type  uuid;
  v_category   uuid;
begin
  select * into v_fin from public.project_finance where project_id = p_project_id;
  select * into v_existing from public.transactions where project_id = p_project_id and kind = 'commission';

  -- Comisionul plătit sau editat de mână nu se mai atinge.
  if v_existing.id is not null and (v_existing.status = 'realized' or v_existing.manual_override) then
    return;
  end if;

  v_amount := round(coalesce(v_fin.contract_value, 0) * coalesce(v_fin.setter_commission_pct, 0) / 100, 2);

  if v_fin.project_id is null or not v_fin.commission_enabled or v_amount <= 0 then
    delete from public.transactions where project_id = p_project_id and kind = 'commission' and status = 'planned';
    return;
  end if;

  select min(due_date) into v_due from public.transactions
  where project_id = p_project_id and kind = 'installment';
  if v_due is null then
    select start_date into v_due from public.projects where id = p_project_id;
  end if;
  v_due := coalesce(v_due, public.today_ro());

  select id, default_category_id into v_cost_type, v_category from public.cost_types where is_commission limit 1;

  if v_existing.id is null then
    insert into public.transactions (type, amount, status, due_date, category_id, project_id, kind, cost_type_id, person, description)
    values ('expense', v_amount, 'planned', v_due, v_category, p_project_id, 'commission', v_cost_type, v_fin.setter_name, 'Comision setter');
  else
    update public.transactions
       set amount = v_amount,
           due_date = v_due,
           person = v_fin.setter_name,
           cost_type_id = coalesce(transactions.cost_type_id, v_cost_type),
           category_id = coalesce(transactions.category_id, v_category)
     where id = v_existing.id;
  end if;
end;
$$;

create or replace function public.project_finance_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_project_commission(new.project_id);
  return null;
end;
$$;

create trigger project_finance_commission after insert or update on public.project_finance
  for each row execute function public.project_finance_commission();

create or replace function public.installments_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.kind = 'installment' and old.project_id is not null then
    perform public.sync_project_commission(old.project_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.kind = 'installment' and new.project_id is not null
     and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id or new.due_date is distinct from old.due_date) then
    perform public.sync_project_commission(new.project_id);
  end if;
  return null;
end;
$$;

create trigger transactions_installments_commission after insert or update or delete on public.transactions
  for each row execute function public.installments_commission();

create or replace function public.projects_start_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.start_date is distinct from old.start_date then
    perform public.sync_project_commission(new.id);
  end if;
  return null;
end;
$$;

create trigger projects_start_commission after update of start_date on public.projects
  for each row execute function public.projects_start_commission();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.actors                   enable row level security;
alter table public.projects                 enable row level security;
alter table public.project_finance          enable row level security;
alter table public.project_stage_deadlines  enable row level security;
alter table public.project_actors           enable row level security;
alter table public.shoots                   enable row level security;
alter table public.shoot_actors             enable row level security;
alter table public.transactions             enable row level security;

create policy actors_access on public.actors for all to authenticated
  using (public.can_access_production()) with check (public.can_access_production());
create policy projects_access on public.projects for all to authenticated
  using (public.can_access_production()) with check (public.can_access_production());
create policy project_stage_deadlines_access on public.project_stage_deadlines for all to authenticated
  using (public.can_access_production()) with check (public.can_access_production());
create policy project_actors_access on public.project_actors for all to authenticated
  using (public.can_access_production()) with check (public.can_access_production());
create policy shoots_access on public.shoots for all to authenticated
  using (public.can_access_production()) with check (public.can_access_production());
create policy shoot_actors_access on public.shoot_actors for all to authenticated
  using (public.can_access_production()) with check (public.can_access_production());

create policy project_finance_admin on public.project_finance for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy transactions_admin on public.transactions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Recalcularea comisionului rulează doar din triggere (ca proprietar), nu direct din API.
revoke execute on function public.sync_project_commission(uuid) from public, anon, authenticated;
