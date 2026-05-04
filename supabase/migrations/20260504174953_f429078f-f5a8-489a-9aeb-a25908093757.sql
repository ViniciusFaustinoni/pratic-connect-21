DO $$
BEGIN
  PERFORM cron.unschedule('cron-recheck-debitos-troca-diario');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'cron-recheck-debitos-troca-diario',
  '0 3 * * *',
  $cron$
  SELECT net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-recheck-debitos-troca',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI'
    ),
    body:=jsonb_build_object('source','cron','at',now())
  ) AS request_id;
  $cron$
);