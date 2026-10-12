-- =====================================================================
-- Ecomlab CRM — Servicii și pași pe proiect (înlocuiesc stadiile globale)
--
--   • services        : ce vinzi (Clipuri video, Statice, Website…), din Setări.
--   • service_steps   : pașii fiecărui serviciu, în ordine, cu termen sugerat.
--   • project_services: serviciile alese pe un proiect (poate avea mai multe).
--   • project_tasks   : checklist-ul proiectului — bifezi ce ai făcut.
--
-- Unde e proiectul = primul pas nebifat. Proiectul e livrat când toți pașii sunt bifați.
-- Proiectele existente primesc serviciul „Clipuri video”, cu pașii din vechile stadii.
-- Tabelele vechi (project_stages, project_stage_deadlines) rămân, dar nu mai sunt folosite.
-- =====================================================================

create table public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  color       text not null default '#64748b',
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index services_name_key on public.services (lower(name));

create table public.service_steps (
  id                   uuid primary key default gen_random_uuid(),
  service_id           uuid not null references public.services (id) on delete cascade,
  name                 text not null check (length(trim(name)) > 0),
  sort_order           int  not null default 0,
  default_offset_days  int check (default_offset_days between 0 and 365),  -- termen sugerat: start + N zile
  created_at           timestamptz not null default now()
);

create index service_steps_service_idx on public.service_steps (service_id, sort_order);

create table public.project_services (
  project_id  uuid not null references public.projects (id) on delete cascade,
  service_id  uuid not null references public.services (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (project_id, service_id)
);

create table public.project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  service_id  uuid references public.services (id) on delete set null,
  title       text not null check (length(trim(title)) > 0),
  sort_order  double precision not null default 0,
  due_date    date,
  done_at     date,
  created_at  timestamptz not null default now()
);

create index project_tasks_project_idx on public.project_tasks (project_id, sort_order);
create index project_tasks_due_idx on public.project_tasks (due_date) where done_at is null;

-- Proiect livrat = are pași și toți sunt bifați (se ține la zi automat).
alter table public.projects add column if not exists delivered_at date;

create or replace function public.refresh_project_delivered(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_open  int;
begin
  select count(*), count(*) filter (where done_at is null)
  into v_total, v_open
  from public.project_tasks
  where project_id = p_project_id;

  update public.projects
  set delivered_at = case when v_total > 0 and v_open = 0 then coalesce(delivered_at, public.today_ro()) end
  where id = p_project_id
    and (delivered_at is null) = (v_total > 0 and v_open = 0);
end;
$$;

create or replace function public.project_tasks_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_project_delivered(coalesce(new.project_id, old.project_id));
  return null;
end;
$$;

create trigger project_tasks_delivered after insert or update or delete on public.project_tasks
  for each row execute function public.project_tasks_delivered();

revoke execute on function public.refresh_project_delivered(uuid) from public, anon, authenticated;

-- Stadiile vechi nu mai generează nimic automat.
drop trigger if exists projects_init_stages on public.projects;
drop trigger if exists projects_stage_progress on public.projects;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.services          enable row level security;
alter table public.service_steps     enable row level security;
alter table public.project_services  enable row level security;
alter table public.project_tasks     enable row level security;

create policy services_select on public.services for select to authenticated using (true);
create policy services_write  on public.services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy service_steps_select on public.service_steps for select to authenticated using (true);
create policy service_steps_write  on public.service_steps for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy project_services_access on public.project_services for all to authenticated
  using (public.can_access_production()) with check (public.can_access_production());
create policy project_tasks_access on public.project_tasks for all to authenticated
  using (public.can_access_production()) with check (public.can_access_production());

-- ---------------------------------------------------------------------
-- Servicii implicite
-- ---------------------------------------------------------------------

insert into public.services (name, color, sort_order) values
  ('Clipuri video', '#f97316', 10),
  ('Statice',       '#6366f1', 20),
  ('Website',       '#06b6d4', 30);

-- Clipuri video: pașii vin din stadiile pe care le aveai deja.
insert into public.service_steps (service_id, name, sort_order, default_offset_days)
select v.id, s.name, s.sort_order, s.default_offset_days
from public.project_stages s
cross join (select id from public.services where name = 'Clipuri video') v;

insert into public.service_steps (service_id, name, sort_order, default_offset_days)
select v.id, step.name, step.sort_order, step.days
from (select id from public.services where name = 'Statice') v
cross join (values
  ('Brief primit',   10, 0),
  ('Concepte',       20, 3),
  ('Design',         30, 5),
  ('Revizie client', 40, 7),
  ('Livrat',         50, 10)
) as step (name, sort_order, days);

insert into public.service_steps (service_id, name, sort_order, default_offset_days)
select v.id, step.name, step.sort_order, step.days
from (select id from public.services where name = 'Website') v
cross join (values
  ('Brief și conținut primit', 10, 0),
  ('Structură / wireframe',    20, 5),
  ('Design',                   30, 10),
  ('Aprobare design',          40, 14),
  ('Dezvoltare',               50, 21),
  ('Testare',                  60, 26),
  ('Lansare',                  70, 30)
) as step (name, sort_order, days);

-- ---------------------------------------------------------------------
-- Proiectele existente → „Clipuri video”, cu checklist din vechile etape
-- ---------------------------------------------------------------------

insert into public.project_services (project_id, service_id)
select p.id, v.id
from public.projects p
cross join (select id from public.services where name = 'Clipuri video') v;

-- Un pas e bifat dacă etapa avea „realizat la” sau era înaintea stadiului curent.
insert into public.project_tasks (project_id, service_id, title, sort_order, due_date, done_at)
select p.id, v.id, s.name, s.sort_order, d.planned_date,
       coalesce(
         d.completed_date,
         case when cur.sort_order is not null and (s.sort_order < cur.sort_order or (cur.is_final and s.id = cur.id))
              then public.today_ro() end
       )
from public.projects p
cross join public.project_stages s
cross join (select id from public.services where name = 'Clipuri video') v
left join public.project_stage_deadlines d on d.project_id = p.id and d.stage_id = s.id
left join public.project_stages cur on cur.id = p.current_stage_id;
