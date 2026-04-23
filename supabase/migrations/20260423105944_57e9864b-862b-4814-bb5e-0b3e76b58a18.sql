CREATE TABLE IF NOT EXISTS public.sga_reconciliacao_veiculo_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id uuid NOT NULL REFERENCES public.associados(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  codigo_hinova_associado integer NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  proximo_retry_em timestamptz NULL,
  veiculos_resolvidos integer NULL DEFAULT 0,
  ultimo_erro text NULL,
  tentativas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sga_recon_veiculo_jobs_associado_unique UNIQUE (associado_id)
);

CREATE INDEX IF NOT EXISTS idx_recon_pendente
  ON public.sga_reconciliacao_veiculo_jobs(created_at)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_recon_retry
  ON public.sga_reconciliacao_veiculo_jobs(proximo_retry_em)
  WHERE status = 'pendente_retry';

ALTER TABLE public.sga_reconciliacao_veiculo_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_recon_jobs" ON public.sga_reconciliacao_veiculo_jobs;
CREATE POLICY "admin_all_recon_jobs"
  ON public.sga_reconciliacao_veiculo_jobs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_update_recon_jobs_updated_at ON public.sga_reconciliacao_veiculo_jobs;
CREATE TRIGGER trg_update_recon_jobs_updated_at
  BEFORE UPDATE ON public.sga_reconciliacao_veiculo_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();