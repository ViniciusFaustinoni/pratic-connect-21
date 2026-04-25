-- Índice único parcial: impede 2 jobs ativos para o mesmo (veiculo, tipo)
CREATE UNIQUE INDEX IF NOT EXISTS sga_sync_financeiro_jobs_ativo_uniq
  ON public.sga_sync_financeiro_jobs (veiculo_id, tipo)
  WHERE status IN ('pendente','pendente_retry','executando');