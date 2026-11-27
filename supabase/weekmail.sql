-- ============================================================
-- Zondagmail: tabel + planner (pg_cron)
--
-- weekmail_verstuurd: onthoudt per lid per week dat de mail weg is,
-- zodat niemand er ooit twee in één week krijgt. Alleen de server
-- (service role) mag erin: RLS aan, geen regels voor gewone gebruikers.
--
-- Planner: elke zondag vanaf 17:00 UTC (= 18u in de winter, 19u in de
-- zomer in België) roept de database de Edge Function "weekmail" aan,
-- elke 10 minuten tot 20:50 UTC. Elke ronde doet max. 80 leden en gaat
-- verder waar de vorige stopte (zie functions/weekmail/index.ts).
-- (Oorspronkelijk één keer per zondag om 17:00; aangepast 27 nov 2026.)
-- ============================================================

create table if not exists public.weekmail_verstuurd (
  user_id uuid not null references auth.users(id) on delete cascade,
  week date not null,
  verstuurd timestamptz not null default now(),
  primary key (user_id, week)
);
alter table public.weekmail_verstuurd enable row level security;
comment on table public.weekmail_verstuurd is 'Zondagmail: per lid per week maximaal één mail. Alleen de server schrijft hierin.';

create extension if not exists pg_cron;

select cron.schedule(
  'zondagmail',
  '*/10 17-20 * * 0',
  $$ select net.http_post(
       url := 'https://wrwwwgquqaqnmphrhvyr.supabase.co/functions/v1/weekmail',
       body := '{}'::jsonb,
       headers := '{"Content-Type": "application/json"}'::jsonb,
       timeout_milliseconds := 60000
     ); $$
);
