-- =====================================================================
-- Ecomlab CRM — Tarif pe oră la actori
-- Unitățile de tarif devin: per clip, per oră, per zi, per proiect.
-- Scriptul se poate rula de mai multe ori.
-- =====================================================================

do $$
declare
  c record;
begin
  -- Scoatem vechea regulă (clip / zi / proiect), oricum s-ar numi.
  for c in
    select conname from pg_constraint
    where conrelid = 'public.actors'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%rate_unit%'
  loop
    execute format('alter table public.actors drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.actors
  add constraint actors_rate_unit_check check (rate_unit in ('clip', 'ora', 'zi', 'proiect'));
