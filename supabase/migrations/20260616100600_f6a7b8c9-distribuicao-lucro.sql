-- =============================================
-- FECHAMENTO MENSAL & DISTRIBUIÇÃO DE LUCRO
-- Lucro = Receita - Despesa -> % Caixa (reserva) + DL por sócio
-- (DL mínimo, pró-labore e IR sobre distribuição)
-- =============================================

-- Parâmetros (uma linha, editável na tela)
CREATE TABLE IF NOT EXISTS public.distribuicao_parametros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  percentual_caixa DECIMAL(5,2) NOT NULL DEFAULT 20,
  dl_minimo DECIMAL(12,2) NOT NULL DEFAULT 45000,
  pro_labore DECIMAL(12,2) NOT NULL DEFAULT 6070.73,
  aliquota_ir DECIMAL(5,2) NOT NULL DEFAULT 0,
  num_socios INTEGER NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.distribuicao_parametros (percentual_caixa, dl_minimo, pro_labore, aliquota_ir, num_socios)
SELECT 20, 45000, 6070.73, 0, 3
WHERE NOT EXISTS (SELECT 1 FROM public.distribuicao_parametros);

-- Fechamento mensal
CREATE TABLE IF NOT EXISTS public.distribuicoes_lucro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  receita_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  despesa_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  lucro DECIMAL(14,2) NOT NULL DEFAULT 0,
  percentual_caixa DECIMAL(5,2) NOT NULL DEFAULT 20,
  valor_caixa DECIMAL(14,2) NOT NULL DEFAULT 0,
  valor_distribuivel DECIMAL(14,2) NOT NULL DEFAULT 0,
  num_socios INTEGER NOT NULL DEFAULT 3,
  valor_por_socio DECIMAL(14,2) NOT NULL DEFAULT 0,
  pro_labore DECIMAL(12,2) NOT NULL DEFAULT 0,
  dl_minimo DECIMAL(12,2) NOT NULL DEFAULT 0,
  aliquota_ir DECIMAL(5,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'fechado')),
  observacao TEXT,
  fechado_por UUID REFERENCES public.profiles(id),
  fechado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ano, mes)
);

-- Cota por sócio
CREATE TABLE IF NOT EXISTS public.distribuicao_lucro_socios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuicao_id UUID NOT NULL REFERENCES public.distribuicoes_lucro(id) ON DELETE CASCADE,
  socio_id UUID REFERENCES public.profiles(id),
  socio_nome VARCHAR(255) NOT NULL,
  cota_lucro DECIMAL(14,2) NOT NULL DEFAULT 0,
  pro_labore DECIMAL(12,2) NOT NULL DEFAULT 0,
  dl_minimo DECIMAL(12,2) NOT NULL DEFAULT 0,
  ir_valor DECIMAL(14,2) NOT NULL DEFAULT 0,
  valor_liquido DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distrib_socios ON public.distribuicao_lucro_socios(distribuicao_id);

-- RLS
ALTER TABLE public.distribuicao_parametros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuicoes_lucro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuicao_lucro_socios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ler distrib_parametros" ON public.distribuicao_parametros;
CREATE POLICY "ler distrib_parametros" ON public.distribuicao_parametros
FOR SELECT TO authenticated USING (public.is_funcionario(auth.uid()) OR public.is_socio(auth.uid()));

DROP POLICY IF EXISTS "gerir distrib_parametros" ON public.distribuicao_parametros;
CREATE POLICY "gerir distrib_parametros" ON public.distribuicao_parametros
FOR ALL TO authenticated
USING (public.is_socio(auth.uid()) OR public.has_role(auth.uid(), 'diretor'))
WITH CHECK (public.is_socio(auth.uid()) OR public.has_role(auth.uid(), 'diretor'));

DROP POLICY IF EXISTS "ler distribuicoes" ON public.distribuicoes_lucro;
CREATE POLICY "ler distribuicoes" ON public.distribuicoes_lucro
FOR SELECT TO authenticated USING (public.is_funcionario(auth.uid()) OR public.is_socio(auth.uid()));

DROP POLICY IF EXISTS "gerir distribuicoes" ON public.distribuicoes_lucro;
CREATE POLICY "gerir distribuicoes" ON public.distribuicoes_lucro
FOR ALL TO authenticated
USING (public.is_socio(auth.uid()) OR public.has_role(auth.uid(), 'diretor'))
WITH CHECK (public.is_socio(auth.uid()) OR public.has_role(auth.uid(), 'diretor'));

DROP POLICY IF EXISTS "ler distrib_socios" ON public.distribuicao_lucro_socios;
CREATE POLICY "ler distrib_socios" ON public.distribuicao_lucro_socios
FOR SELECT TO authenticated USING (public.is_funcionario(auth.uid()) OR public.is_socio(auth.uid()));

DROP POLICY IF EXISTS "gerir distrib_socios" ON public.distribuicao_lucro_socios;
CREATE POLICY "gerir distrib_socios" ON public.distribuicao_lucro_socios
FOR ALL TO authenticated
USING (public.is_socio(auth.uid()) OR public.has_role(auth.uid(), 'diretor'))
WITH CHECK (public.is_socio(auth.uid()) OR public.has_role(auth.uid(), 'diretor'));
