-- =============================================
-- SOLICITAÇÕES FINANCEIRAS — campos adicionais
-- setor, data de vencimento, prioridade e nº do documento/NF
-- =============================================

ALTER TABLE public.solicitacoes_financeiras
  ADD COLUMN IF NOT EXISTS setor VARCHAR(50),
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS prioridade VARCHAR(10) NOT NULL DEFAULT 'normal'
    CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(60);

-- Migra dados existentes: usa a data_necessidade como vencimento quando houver
UPDATE public.solicitacoes_financeiras
   SET data_vencimento = data_necessidade
 WHERE data_vencimento IS NULL
   AND data_necessidade IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solic_fin_setor ON public.solicitacoes_financeiras(setor);
CREATE INDEX IF NOT EXISTS idx_solic_fin_vencimento ON public.solicitacoes_financeiras(data_vencimento);
