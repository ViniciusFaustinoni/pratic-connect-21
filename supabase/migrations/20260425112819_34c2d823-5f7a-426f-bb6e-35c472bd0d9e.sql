
-- Acelera o cron de drenagem do financeiro Hinova: 5min -> 2min
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'sga-sync-financeiro-drenagem-5min'),
  schedule := '*/2 9-23,0-1 * * *'
);
