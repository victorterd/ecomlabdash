-- =====================================================================
-- Ecomlab CRM — Follow-up-uri făcute (jurnal pe lead)
--
-- Când faci un follow-up îl bifezi: ce s-a întâmplat (statusul nou), o notiță
-- și când e următorul. Rămâne în istoricul lead-ului.
-- Scriptul se poate rula de mai multe ori.
-- =====================================================================

create table if not exists public.lead_activities (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads (id) on delete cascade,
  done_on         date not null default public.today_ro(),
  note            text,
  status_id       uuid references public.lead_statuses (id) on delete set null,  -- rezultatul (statusul după follow-up)
  next_follow_up  date,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id, done_on desc, created_at desc);

alter table public.lead_activities enable row level security;

drop policy if exists lead_activities_access on public.lead_activities;
create policy lead_activities_access on public.lead_activities for all to authenticated
  using (public.can_access_leads()) with check (public.can_access_leads());
