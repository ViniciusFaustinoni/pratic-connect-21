
ALTER TABLE public.sga_sync_financeiro_jobs DROP CONSTRAINT IF EXISTS sga_sync_financeiro_jobs_status_check;
ALTER TABLE public.sga_sync_financeiro_jobs ADD CONSTRAINT sga_sync_financeiro_jobs_status_check
  CHECK (status = ANY (ARRAY['pendente'::text, 'pendente_retry'::text, 'executando'::text, 'concluido'::text, 'erro'::text, 'sem_historico_hinova'::text, 'cancelado'::text]));

UPDATE public.sga_sync_financeiro_jobs
SET status = 'pendente_retry',
    proximo_retry_em = (
      (date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) + interval '1 day' + interval '9 hours')
      AT TIME ZONE 'America/Sao_Paulo'
    ),
    updated_at = now()
WHERE status = 'erro'
  AND (
    ultimo_erro ILIKE '%restri%'
    OR ultimo_erro ILIKE E'%hor\\u00e1ri%'
    OR ultimo_erro ILIKE '%codigo_erro%401%'
    OR ultimo_erro ILIKE '%autentica%401%'
  );
