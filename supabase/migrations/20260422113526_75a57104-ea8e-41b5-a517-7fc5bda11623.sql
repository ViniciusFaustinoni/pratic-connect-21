-- Adiciona status 'cancelado' ao check constraint
ALTER TABLE public.sga_sync_financeiro_jobs
  DROP CONSTRAINT IF EXISTS sga_sync_financeiro_jobs_status_check;

ALTER TABLE public.sga_sync_financeiro_jobs
  ADD CONSTRAINT sga_sync_financeiro_jobs_status_check
  CHECK (status IN ('pendente', 'executando', 'concluido', 'erro', 'sem_historico_hinova', 'cancelado'));

-- Cancela jobs existentes de veículos cujo associado é 'interno' (sistema novo)
UPDATE public.sga_sync_financeiro_jobs j
SET status = 'cancelado',
    ultimo_erro = 'Veículo da base nova (origem_cadastro=interno) — não elegível para sincronização financeira do SGA',
    concluido_em = COALESCE(j.concluido_em, now()),
    updated_at = now()
FROM public.veiculos v
JOIN public.associados a ON a.id = v.associado_id
WHERE j.veiculo_id = v.id
  AND a.origem_cadastro = 'interno'
  AND j.status IN ('pendente', 'executando', 'erro', 'sem_historico_hinova');