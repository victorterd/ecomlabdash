-- =====================================================================
-- Ecomlab CRM — declanșator la fiecare 15 minute (Supabase pg_cron + pg_net)
-- =====================================================================
-- Vercel Cron (planul gratuit) rulează o singură dată pe zi. Ca emailul să
-- plece la ora aleasă în Setări și push-ul să vină la ora fiecărui follow-up,
-- Supabase apelează aplicația la fiecare 15 minute.
--
-- ÎNAINTE DE RULARE înlocuiește:
--   https://ADRESA-TA.vercel.app   → adresa aplicației (fără / la final)
--   SECRETUL-DIN-VERCEL            → valoarea variabilei CRON_SECRET din Vercel
--
-- Rulează o singură dată în Supabase → SQL Editor. Poți rula din nou oricând
-- (înlocuiește jobul existent).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('ecomlab-tick') where exists (select 1 from cron.job where jobname = 'ecomlab-tick');

select cron.schedule(
  'ecomlab-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://ADRESA-TA.vercel.app/api/cron/tick',
    headers := jsonb_build_object('Authorization', 'Bearer SECRETUL-DIN-VERCEL', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Verificare: ultimele rulări și răspunsurile aplicației
-- select * from cron.job_run_details order by start_time desc limit 5;
-- select status_code, content from net._http_response order by created desc limit 5;
