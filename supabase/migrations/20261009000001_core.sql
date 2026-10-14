-- =====================================================================
-- Ecomlab CRM — Etapa 1: utilizatori, setări, liste configurabile, RLS
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Utilitare
-- ---------------------------------------------------------------------

-- „Azi” în fusul orar al României, indiferent de fusul serverului.
create or replace function public.today_ro()
returns date
language sql
stable
as $$
  select (now() at time zone 'Europe/Bucharest')::date
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Profiluri și roluri
-- ---------------------------------------------------------------------

create type public.user_role as enum ('admin', 'setter', 'productie');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  role        public.user_role not null default 'productie',
  theme       text not null default 'light' check (theme in ('light', 'dark', 'system')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Rolul utilizatorului curent. SECURITY DEFINER ca să poată fi folosit în
-- politicile RLS fără recursivitate pe tabela profiles.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- Primul cont creat devine admin; următoarele primesc rolul „productie”
-- (rolul se schimbă din Setări → Utilizatori).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from public.profiles) into is_first;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when is_first then 'admin'::public.user_role else 'productie'::public.user_role end
  );

  insert into public.notification_prefs (user_id) values (new.id);
  return new;
end;
$$;

-- Un utilizator își poate edita numele și tema, dar nu și rolul.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Doar un admin poate schimba rolul unui utilizator';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------
-- Setări (câte un singur rând)
-- ---------------------------------------------------------------------

create table public.app_settings (
  id                      boolean primary key default true check (id),
  follow_up_days          int     not null default 7 check (follow_up_days between 0 and 365),
  follow_up_default_time  time    not null default '10:00',
  deadline_warning_days   int     not null default 7 check (deadline_warning_days between 0 and 90),
  daily_email_time        time    not null default '08:00',
  timezone                text    not null default 'Europe/Bucharest',
  updated_at              timestamptz not null default now()
);

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings default values;

create table public.finance_settings (
  id                     boolean primary key default true check (id),
  setter_commission_pct  numeric(5, 2)  not null default 15.00 check (setter_commission_pct between 0 and 100),
  profit_tax_pct         numeric(5, 2)  not null default 16.00 check (profit_tax_pct between 0 and 100),
  dividend_tax_pct       numeric(5, 2)  not null default 16.00 check (dividend_tax_pct between 0 and 100),
  opening_balance        numeric(14, 2) not null default 0,
  opening_balance_date   date           not null default public.today_ro(),
  updated_at             timestamptz    not null default now()
);

create trigger finance_settings_updated_at before update on public.finance_settings
  for each row execute function public.set_updated_at();

insert into public.finance_settings default values;

-- ---------------------------------------------------------------------
-- Notificări
-- ---------------------------------------------------------------------

create table public.notification_prefs (
  user_id                  uuid primary key references public.profiles (id) on delete cascade,
  email_daily              boolean not null default true,
  push_enabled             boolean not null default true,
  notify_followups         boolean not null default true,
  notify_followup_at_time  boolean not null default true,
  notify_installments      boolean not null default true,
  notify_payments          boolean not null default true,
  notify_shoots            boolean not null default true,
  notify_stage_deadlines   boolean not null default true,
  email_to                 text,
  updated_at               timestamptz not null default now()
);

create trigger notification_prefs_updated_at before update on public.notification_prefs
  for each row execute function public.set_updated_at();

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create table public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  channel    text not null check (channel in ('email', 'push')),
  kind       text not null,
  ref_id     uuid,
  for_date   date not null,
  sent_at    timestamptz not null default now()
);

create unique index notification_log_dedupe
  on public.notification_log (user_id, channel, kind, coalesce(ref_id, '00000000-0000-0000-0000-000000000000'::uuid), for_date);

-- ---------------------------------------------------------------------
-- Liste configurabile
-- ---------------------------------------------------------------------

create table public.lead_statuses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  color         text not null default '#64748b',
  sort_order    int  not null default 0,
  is_default    boolean not null default false,  -- statusul unui lead nou
  is_follow_up  boolean not null default false,  -- setează automat data de follow-up
  is_won        boolean not null default false,  -- afișează „Creează proiect”
  is_closed     boolean not null default false,  -- nu mai apare în remindere
  created_at    timestamptz not null default now()
);

create unique index lead_statuses_name_key on public.lead_statuses (lower(name));
create unique index lead_statuses_one_default on public.lead_statuses (is_default) where is_default;

create table public.lead_sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index lead_sources_name_key on public.lead_sources (lower(name));

create table public.project_stages (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  color                text not null default '#64748b',
  sort_order           int  not null default 0,
  is_final             boolean not null default false,  -- proiect livrat
  default_offset_days  int,                             -- termen sugerat: start + N zile
  created_at           timestamptz not null default now()
);

create unique index project_stages_name_key on public.project_stages (lower(name));

create table public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#64748b',
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index expense_categories_name_key on public.expense_categories (lower(name));

create table public.cost_types (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  sort_order           int  not null default 0,
  default_category_id  uuid references public.expense_categories (id) on delete set null,
  is_commission        boolean not null default false,  -- linia generată automat din comision
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);

create unique index cost_types_name_key on public.cost_types (lower(name));
create unique index cost_types_one_commission on public.cost_types (is_commission) where is_commission;

-- Valori implicite ----------------------------------------------------

insert into public.lead_statuses (name, color, sort_order, is_default, is_follow_up, is_won, is_closed) values
  ('Recepție',     '#64748b', 10, true,  false, false, false),
  ('Nu a răspuns', '#f59e0b', 20, false, false, false, false),
  ('Follow up',    '#3b82f6', 30, false, true,  false, false),
  ('Trimis mail',  '#8b5cf6', 40, false, false, false, false),
  ('Nu vrea',      '#ef4444', 50, false, false, false, true),
  ('Meet setat',   '#06b6d4', 60, false, false, false, false),
  ('Câștigat',     '#1cdb10', 70, false, false, true,  true);

insert into public.lead_sources (name, sort_order) values
  ('Cold call', 10), ('TikTok form', 20), ('Recomandare', 30), ('Altele', 40);

insert into public.project_stages (name, color, sort_order, is_final, default_offset_days) values
  ('Semnat',            '#64748b',  10, false, 0),
  ('Produs primit',     '#a855f7',  20, false, 3),
  ('Scripturi',         '#6366f1',  30, false, 7),
  ('Revizie scripturi', '#3b82f6',  40, false, 9),
  ('Casting',           '#06b6d4',  50, false, 12),
  ('Filmare',           '#f59e0b',  60, false, 16),
  ('Editare',           '#f97316',  70, false, 21),
  ('Revizie edit',      '#ec4899',  80, false, 24),
  ('Livrat',            '#1cdb10',  90, true,  28);

insert into public.expense_categories (name, color, sort_order) values
  ('Echipă producție',     '#1cdb10', 10),
  ('Ads (TikTok/Meta)',    '#3b82f6', 20),
  ('Soft-uri',             '#8b5cf6', 30),
  ('Contabilitate / taxe', '#f59e0b', 40);

insert into public.cost_types (name, sort_order, default_category_id, is_commission)
select t.name, t.sort_order, c.id, t.is_commission
from (values
  ('Editor',                     10, false),
  ('Cameraman',                  20, false),
  ('Actor',                      30, false),
  ('Agent vânzări (comision)',   40, true),
  ('Scenarist',                  50, false)
) as t(name, sort_order, is_commission)
cross join (select id from public.expense_categories where name = 'Echipă producție') c;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.app_settings        enable row level security;
alter table public.finance_settings    enable row level security;
alter table public.notification_prefs  enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.notification_log    enable row level security;
alter table public.lead_statuses       enable row level security;
alter table public.lead_sources        enable row level security;
alter table public.project_stages      enable row level security;
alter table public.expense_categories  enable row level security;
alter table public.cost_types          enable row level security;

-- profiles: fiecare își vede profilul; adminul îi vede pe toți
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Setări generale și liste de lead/proiect: citire pentru toți, scriere admin
create policy app_settings_select on public.app_settings for select to authenticated using (true);
create policy app_settings_write  on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy lead_statuses_select on public.lead_statuses for select to authenticated using (true);
create policy lead_statuses_write  on public.lead_statuses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy lead_sources_select on public.lead_sources for select to authenticated using (true);
create policy lead_sources_write  on public.lead_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy project_stages_select on public.project_stages for select to authenticated using (true);
create policy project_stages_write  on public.project_stages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Financiar: doar admin
create policy finance_settings_admin on public.finance_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy expense_categories_admin on public.expense_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy cost_types_admin on public.cost_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Notificări: fiecare utilizator le gestionează pe ale lui
create policy notification_prefs_own on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notification_log_own on public.notification_log for select to authenticated
  using (user_id = auth.uid());
