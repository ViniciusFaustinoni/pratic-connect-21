ALTER TABLE public.solicitacoes_troca_titularidade
  ADD COLUMN IF NOT EXISTS sga_codigo_associado_novo BIGINT,
  ADD COLUMN IF NOT EXISTS sga_codigo_veiculo_novo BIGINT,
  ADD COLUMN IF NOT EXISTS sga_status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS sga_erro TEXT,
  ADD COLUMN IF NOT EXISTS sga_sincronizado_em TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_troca_titularidade_sga_status
  ON public.solicitacoes_troca_titularidade (sga_status)
  WHERE sga_status <> 'sincronizado';