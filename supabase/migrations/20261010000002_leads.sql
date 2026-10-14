-- =====================================================================
-- Ecomlab CRM — Etapa 2: lead-uri, istoric status, duplicate, importuri
-- =====================================================================

-- Statusul „Necontactat” (folosit în fișierul existent) devine implicit.
update public.lead_statuses set is_default = false where is_default;

insert into public.lead_statuses (name, color, sort_order, is_default)
select 'Necontactat', '#94a3b8', 5, true
where not exists (select 1 from public.lead_statuses where lower(name) = 'necontactat');

update public.lead_statuses set is_default = true where lower(name) = 'necontactat';

-- ---------------------------------------------------------------------
-- Normalizare pentru detectarea duplicatelor
-- ---------------------------------------------------------------------

-- „https://www.Exemplu.ro/magazin?x=1” → „exemplu.ro”
create or replace function public.normalize_domain(value text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(
    case when d like '%.%' then d end,
    ''
  )
  from (
    select regexp_replace(
      regexp_replace(lower(trim(coalesce(value, ''))), '^[a-z]+://', ''),
      '^www\.|[/?#:].*$', '', 'g'
    ) as d
  ) s
$$;

-- O celulă poate conține mai multe site-uri: „a.ro, https://b.ro/”.
create or replace function public.lead_domains(value text)
returns text[]
language sql
immutable
parallel safe
as $$
  select coalesce(array_agg(distinct d order by d), '{}')
  from (
    select public.normalize_domain(part) as d
    from regexp_split_to_table(coalesce(value, ''), '[,;\s]+') as part
  ) s
  where d is not null
$$;

-- „+40 726 754 999”, „0040726754999”, „40726754999” → „0726754999”
create or replace function public.normalize_phone(value text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when length(n) < 6 then null
    else n
  end
  from (
    select case
      when digits like '0040%' then '0' || substr(digits, 5)
      when digits like '40%' and length(digits) = 11 then '0' || substr(digits, 3)
      else digits
    end as n
    from (select regexp_replace(coalesce(value, ''), '\D', '', 'g') as digits) d
  ) s
$$;

-- Toate telefoanele unui lead (fiecare câmp poate avea mai multe numere).
create or replace function public.lead_phones(phone1 text, phone2 text)
returns text[]
language sql
immutable
parallel safe
as $$
  select coalesce(array_agg(distinct p order by p), '{}')
  from (
    select public.normalize_phone(part) as p
    from regexp_split_to_table(coalesce(phone1, '') || ',' || coalesce(phone2, ''), '[,;/]+') as part
  ) s
  where p is not null
$$;

create or replace function public.normalize_email(value text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(lower(trim(coalesce(value, ''))), '')
$$;

-- ---------------------------------------------------------------------
-- Lead-uri
-- ---------------------------------------------------------------------

create table public.leads (
  id                 uuid primary key default gen_random_uuid(),
  company_name       text not null check (length(trim(company_name)) > 0),
  website            text,
  owner_name         text,
  email              text,
  phone1             text,
  phone2             text,
  status_id          uuid not null references public.lead_statuses (id),
  source_id          uuid references public.lead_sources (id) on delete set null,
  called_by          text,
  called_by_user_id  uuid references public.profiles (id) on delete set null,
  follow_up_date     date,
  follow_up_time     time,
  potential          text,
  notes              text,
  import_id          uuid,
  is_seed            boolean not null default false,
  created_by         uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  website_domains    text[] generated always as (public.lead_domains(website)) stored,
  phones_norm        text[] generated always as (public.lead_phones(phone1, phone2)) stored,
  email_norm         text   generated always as (public.normalize_email(email)) stored
);

create index leads_status_idx      on public.leads (status_id);
create index leads_follow_up_idx   on public.leads (follow_up_date) where follow_up_date is not null;
create index leads_domains_idx     on public.leads using gin (website_domains);
create index leads_phones_idx      on public.leads using gin (phones_norm);
create index leads_email_idx       on public.leads (email_norm);
create index leads_company_trgm    on public.leads using gin (company_name gin_trgm_ops);

create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

create table public.lead_status_history (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads (id) on delete cascade,
  from_status_id  uuid references public.lead_statuses (id) on delete set null,
  to_status_id    uuid references public.lead_statuses (id) on delete set null,
  changed_by      uuid references public.profiles (id) on delete set null,
  changed_at      timestamptz not null default now()
);

create index lead_status_history_lead_idx on public.lead_status_history (lead_id, changed_at desc);

-- Follow-up automat: când lead-ul intră pe un status de follow-up, data devine
-- azi + N zile (Setări), dacă nu a fost completată explicit în aceeași modificare.
create or replace function public.leads_follow_up()
returns trigger
language plpgsql
as $$
declare
  is_follow_up boolean;
  days int;
begin
  if tg_op = 'UPDATE' and new.status_id is not distinct from old.status_id then
    return new;
  end if;

  select s.is_follow_up into is_follow_up from public.lead_statuses s where s.id = new.status_id;
  if not coalesce(is_follow_up, false) then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.follow_up_date is null)
     or (tg_op = 'UPDATE' and new.follow_up_date is not distinct from old.follow_up_date) then
    select follow_up_days into days from public.app_settings where id;
    new.follow_up_date := public.today_ro() + coalesce(days, 7);
  end if;
  return new;
end;
$$;

create trigger leads_follow_up before insert or update of status_id on public.leads
  for each row execute function public.leads_follow_up();

create or replace function public.leads_log_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status_id is distinct from old.status_id then
    insert into public.lead_status_history (lead_id, from_status_id, to_status_id, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status_id end, new.status_id, auth.uid());
  end if;
  return null;
end;
$$;

create trigger leads_log_status after insert or update of status_id on public.leads
  for each row execute function public.leads_log_status();

-- Acces la lead-uri: admin și setter.
create or replace function public.can_access_leads()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('admin', 'setter') from public.profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------------
-- Duplicate
-- ---------------------------------------------------------------------

-- Primește un array JSON de lead-uri [{website, email, phone1, phone2}, …] și
-- întoarce, pentru fiecare (după poziție), cheile normalizate și primul lead
-- existent care se potrivește pe website, email sau telefon.
--
-- SECURITY DEFINER + verificare explicită de acces: prin RLS, Postgres nu poate
-- folosi indexurile GIN în join-ul lateral și verificarea devine de sute de ori
-- mai lentă (sute de lead-uri × sute de rânduri importate).
create or replace function public.check_lead_duplicates(p_rows jsonb, p_exclude uuid default null)
returns table (
  idx           int,
  domains       text[],
  phones        text[],
  email         text,
  lead_id       uuid,
  company_name  text,
  matched_on    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_access_leads() then
    raise exception 'Acces interzis' using errcode = '42501';
  end if;

  return query
  with r as materialized (
    select
      (e.ordinality - 1)::int as idx,
      public.lead_domains(e.value ->> 'website') as domains,
      public.lead_phones(e.value ->> 'phone1', e.value ->> 'phone2') as phones,
      public.normalize_email(e.value ->> 'email') as email
    from jsonb_array_elements(p_rows) with ordinality as e
  )
  select r.idx, r.domains, r.phones, r.email, m.id, m.company_name, m.matched_on
  from r
  left join lateral (
    select
      l.id,
      l.company_name,
      case
        when l.website_domains && r.domains then 'website'
        when l.email_norm = r.email then 'email'
        else 'telefon'
      end as matched_on
    from public.leads l
    where (l.id is distinct from p_exclude)
      and (
        (cardinality(r.domains) > 0 and l.website_domains && r.domains)
        or (r.email is not null and l.email_norm = r.email)
        or (cardinality(r.phones) > 0 and l.phones_norm && r.phones)
      )
    order by l.created_at
    limit 1
  ) m on true
  order by r.idx;
end;
$$;

-- ---------------------------------------------------------------------
-- Importuri
-- ---------------------------------------------------------------------

create table public.lead_imports (
  id                  uuid primary key default gen_random_uuid(),
  file_name           text not null,
  total_rows          int  not null default 0,
  imported            int  not null default 0,
  skipped_duplicates  int  not null default 0,
  skipped_manual      int  not null default 0,
  errors              jsonb not null default '[]',
  mapping             jsonb,
  created_by          uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now()
);

alter table public.leads add constraint leads_import_fk
  foreign key (import_id) references public.lead_imports (id) on delete set null;

-- ---------------------------------------------------------------------
-- RLS: admin și setter
-- ---------------------------------------------------------------------

alter table public.leads                enable row level security;
alter table public.lead_status_history  enable row level security;
alter table public.lead_imports         enable row level security;

create policy leads_access on public.leads for all to authenticated
  using (public.can_access_leads()) with check (public.can_access_leads());

create policy lead_status_history_select on public.lead_status_history for select to authenticated
  using (public.can_access_leads());

create policy lead_imports_access on public.lead_imports for all to authenticated
  using (public.can_access_leads()) with check (public.can_access_leads());
