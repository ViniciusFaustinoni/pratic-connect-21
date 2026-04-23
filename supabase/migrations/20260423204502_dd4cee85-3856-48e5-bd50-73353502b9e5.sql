ALTER TABLE public.comissoes
ADD COLUMN IF NOT EXISTS calculo_snapshot jsonb;

CREATE INDEX IF NOT EXISTS idx_comissoes_calculo_snapshot_gin
ON public.comissoes USING gin (calculo_snapshot);

COMMENT ON COLUMN public.comissoes.calculo_snapshot IS 'Snapshot de auditoria do cálculo da comissão no momento da geração: grade, plano, parcela, regra, cadeia e valores.';