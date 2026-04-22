-- Atualiza check constraint para incluir 'sem_historico_hinova'
ALTER TABLE public.sga_sync_financeiro_jobs
  DROP CONSTRAINT IF EXISTS sga_sync_financeiro_jobs_status_check;

ALTER TABLE public.sga_sync_financeiro_jobs
  ADD CONSTRAINT sga_sync_financeiro_jobs_status_check
  CHECK (status IN ('pendente', 'executando', 'concluido', 'erro', 'sem_historico_hinova'));

-- Reclassifica jobs já existentes
UPDATE public.sga_sync_financeiro_jobs
SET status = 'sem_historico_hinova',
    updated_at = now()
WHERE status = 'erro'
  AND ultimo_erro ILIKE '%Placa não encontrada na Hinova%';