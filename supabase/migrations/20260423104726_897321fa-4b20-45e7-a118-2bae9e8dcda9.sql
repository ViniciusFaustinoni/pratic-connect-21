ALTER TABLE public.sga_sync_financeiro_jobs
  ADD COLUMN IF NOT EXISTS proximo_retry_em timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_sga_jobs_pendente_retry
  ON public.sga_sync_financeiro_jobs (proximo_retry_em)
  WHERE status = 'pendente_retry';

CREATE INDEX IF NOT EXISTS idx_sga_jobs_status_pendente
  ON public.sga_sync_financeiro_jobs (created_at)
  WHERE status = 'pendente';