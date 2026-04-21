-- 1) Adicionar coluna cenario_adesao em cotacoes (persistir o cenário escolhido)
ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS cenario_adesao text;

ALTER TABLE public.cotacoes
  DROP CONSTRAINT IF EXISTS cotacoes_cenario_adesao_check;

ALTER TABLE public.cotacoes
  ADD CONSTRAINT cotacoes_cenario_adesao_check
  CHECK (cenario_adesao IS NULL OR cenario_adesao IN ('cobra_rota','cobra_base','isenta_rota','isenta_base'));

CREATE INDEX IF NOT EXISTS idx_cotacoes_cenario_adesao ON public.cotacoes(cenario_adesao) WHERE cenario_adesao IS NOT NULL;

-- 2) Adicionar flag em cc_vendedor_lancamentos para abatimento recorrente
ALTER TABLE public.cc_vendedor_lancamentos
  ADD COLUMN IF NOT EXISTS abate_recorrente boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.cc_vendedor_lancamentos.abate_recorrente IS
  'Quando true, este débito é abatido automaticamente dos próximos créditos recorrentes do consultor (ex: cenário Isenta + Rota).';

-- 3) Garantir que movimentacoes_financeiras suporta vínculos para "Repasse Volante"
-- (a tabela já possui referencia_tipo/referencia_id; vamos só documentar a categoria)
COMMENT ON COLUMN public.movimentacoes_financeiras.categoria IS
  'Categoria da movimentação. Inclui: repasse_volante (R$ recebido do cliente em cobra+rota), repasse_volante_pendente (a receber do consultor em isenta+rota).';