-- =====================================================================
-- Ecomlab CRM — To-do personal
--
-- Sarcinile tale (reclamele agenției, setat campanii, orice altceva), cu dată și oră.
-- Fiecare utilizator își vede doar sarcinile lui.
-- Ce nu bifezi trece automat pe ziua următoare (în dashboard și calendar).
-- Scriptul se poate rula de mai multe ori.
-- =====================================================================

create table if not exists public.personal_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  title       text not null check (length(trim(title)) > 0),
  notes       text,
  due_date    date,
  due_time    time,
  done_at     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists personal_tasks_user_idx on public.personal_tasks (user_id, done_at, due_date);

drop trigger if exists personal_tasks_updated_at on public.personal_tasks;
create trigger personal_tasks_updated_at before update on public.personal_tasks
  for each row execute function public.set_updated_at();

alter table public.personal_tasks enable row level security;

drop policy if exists personal_tasks_own on public.personal_tasks;
create policy personal_tasks_own on public.personal_tasks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
