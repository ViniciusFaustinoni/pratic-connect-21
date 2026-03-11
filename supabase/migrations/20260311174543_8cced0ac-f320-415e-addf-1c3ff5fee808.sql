
-- 1. Fix RLS on rateios_detalhes_faixas: drop broken policy, create correct one
DROP POLICY IF EXISTS "Funcionários podem ver detalhes de faixas" ON public.rateios_detalhes_faixas;
DROP POLICY IF EXISTS "Gerência pode ver detalhes por faixa" ON public.rateios_detalhes_faixas;

CREATE POLICY "Gerência pode ver detalhes por faixa"
ON public.rateios_detalhes_faixas
FOR SELECT
TO authenticated
USING (is_gerencia(auth.uid()));

-- Also allow INSERT/DELETE for gerência (needed for recalculation)
DROP POLICY IF EXISTS "Gerência pode inserir detalhes faixas" ON public.rateios_detalhes_faixas;
CREATE POLICY "Gerência pode inserir detalhes faixas"
ON public.rateios_detalhes_faixas
FOR INSERT
TO authenticated
WITH CHECK (is_gerencia(auth.uid()));

DROP POLICY IF EXISTS "Gerência pode deletar detalhes faixas" ON public.rateios_detalhes_faixas;
CREATE POLICY "Gerência pode deletar detalhes faixas"
ON public.rateios_detalhes_faixas
FOR DELETE
TO authenticated
USING (is_gerencia(auth.uid()));

-- 2. Create configuracoes_historico table
CREATE TABLE IF NOT EXISTS public.configuracoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL,
  valor_anterior text,
  valor_novo text NOT NULL,
  alterado_por uuid REFERENCES public.profiles(id),
  alterado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerência pode ver histórico de configurações"
ON public.configuracoes_historico
FOR SELECT
TO authenticated
USING (is_gerencia(auth.uid()));

CREATE POLICY "Gerência pode inserir histórico de configurações"
ON public.configuracoes_historico
FOR INSERT
TO authenticated
WITH CHECK (is_gerencia(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_config_historico_chave ON public.configuracoes_historico(chave);
CREATE INDEX IF NOT EXISTS idx_config_historico_alterado_em ON public.configuracoes_historico(alterado_em DESC);
