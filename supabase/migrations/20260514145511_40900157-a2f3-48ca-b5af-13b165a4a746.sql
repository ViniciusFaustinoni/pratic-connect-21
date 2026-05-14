
-- Tabela de auditoria da reconciliação CSV → cobrancas
CREATE TABLE IF NOT EXISTS public.cobranca_reconciliacao_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES public.cobranca_csv_lotes(id) ON DELETE CASCADE,
  cobranca_id UUID REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  associado_id UUID,
  veiculo_id UUID,
  linha_digitavel TEXT,
  acao TEXT NOT NULL CHECK (acao IN ('pago_por_ausencia','atualizada','criada','ignorada_sem_match','ignorada_recente')),
  valor NUMERIC,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobranca_reconciliacao_log_lote ON public.cobranca_reconciliacao_log(lote_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_reconciliacao_log_cobranca ON public.cobranca_reconciliacao_log(cobranca_id);

ALTER TABLE public.cobranca_reconciliacao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionários veem log de reconciliação"
  ON public.cobranca_reconciliacao_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.tipo <> 'associado'
    )
  );

-- Índice único parcial em cobrancas.linha_digitavel para evitar duplicatas via INSERT
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cobrancas_linha_digitavel
  ON public.cobrancas (linha_digitavel)
  WHERE linha_digitavel IS NOT NULL;
