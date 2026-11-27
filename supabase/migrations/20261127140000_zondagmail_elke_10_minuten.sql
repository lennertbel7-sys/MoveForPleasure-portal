-- Zondagmail in porties: de planner start op zondagavond elke 10 minuten
-- een ronde (17:00-20:50 UTC). Elke ronde verwerkt max. 80 leden.
-- (Uitgevoerd op 27 nov 2026 via cron.alter_job.)
select cron.alter_job(
  (select jobid from cron.job where jobname = 'zondagmail'),
  schedule := '*/10 17-20 * * 0'
);
