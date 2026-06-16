-- =============================================
-- PLANO DE CONTAS (Pratic) + MÓDULO DE RECEITAS
-- Baseado no relatório real "Custos e Receitas"
-- =============================================

-- ---------------------------------------------
-- Plano de contas (categorias financeiras)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  codigo VARCHAR(20) PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  grupo_codigo VARCHAR(20),      -- código do grupo pai (ex.: 2.08)
  nivel INTEGER NOT NULL DEFAULT 1,
  fora_do_custo BOOLEAN NOT NULL DEFAULT false,  -- 2.05 Sócios não entra no custo total
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Receitas (1.01.x)
INSERT INTO public.categorias_financeiras (codigo, nome, tipo, grupo_codigo, nivel, ordem) VALUES
  ('1.01.01', 'Adesão', 'receita', '1.01', 3, 1),
  ('1.01.02', 'Boletos B. Manual', 'receita', '1.01', 3, 2),
  ('1.01.04', 'Cota de Participação Associado', 'receita', '1.01', 3, 3),
  ('1.01.07', 'Boletos Hinova Pay', 'receita', '1.01', 3, 4),
  ('1.01.09', 'Diferença Ressarcimento', 'receita', '1.01', 3, 5)
ON CONFLICT (codigo) DO NOTHING;

-- Grupos de despesa (2.xx)
INSERT INTO public.categorias_financeiras (codigo, nome, tipo, grupo_codigo, nivel, fora_do_custo, ordem) VALUES
  ('2.01', 'Assistência', 'despesa', NULL, 2, false, 1),
  ('2.02', 'Bancos', 'despesa', NULL, 2, false, 2),
  ('2.03', 'Comercial', 'despesa', NULL, 2, false, 3),
  ('2.04', 'Custos com Pessoal', 'despesa', NULL, 2, false, 4),
  ('2.05', 'Sócios', 'despesa', NULL, 2, true, 5),
  ('2.06', 'Custos Fixos', 'despesa', NULL, 2, false, 6),
  ('2.07', 'Custos Variáveis', 'despesa', NULL, 2, false, 7),
  ('2.08', 'Eventos', 'despesa', NULL, 2, false, 8),
  ('2.09', 'Monitoramento', 'despesa', NULL, 2, false, 9),
  ('2.13', 'Sistemas', 'despesa', NULL, 2, false, 13),
  ('2.14', 'Tributos', 'despesa', NULL, 2, false, 14),
  ('2.15', 'Veículos', 'despesa', NULL, 2, false, 15),
  ('2.16', 'Jurídico', 'despesa', NULL, 2, false, 16),
  ('2.17', 'Relacionamento', 'despesa', NULL, 2, false, 17),
  ('2.20', 'Marketing', 'despesa', NULL, 2, false, 20),
  ('2.21', 'Imobilizados', 'despesa', NULL, 2, false, 21),
  ('2.26', 'Benefícios Adicionais Planos', 'despesa', NULL, 2, false, 26),
  ('2.27', 'Oficina', 'despesa', NULL, 2, false, 27),
  ('2.28', 'Loja São Paulo', 'despesa', NULL, 2, false, 28),
  ('2.29', 'Tecnologia', 'despesa', NULL, 2, false, 29)
ON CONFLICT (codigo) DO NOTHING;

-- Vincula a conta do plano nas despesas (sem quebrar a categoria atual)
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS conta_codigo VARCHAR(20) REFERENCES public.categorias_financeiras(codigo);

-- ---------------------------------------------
-- Receitas (entradas)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria_codigo VARCHAR(20) REFERENCES public.categorias_financeiras(codigo),
  categoria_nome VARCHAR(150),
  descricao TEXT,
  valor DECIMAL(14,2) NOT NULL CHECK (valor >= 0),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  origem VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'importacao', 'asaas', 'sga')),
  observacao TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receitas_data ON public.receitas(data);
CREATE INDEX IF NOT EXISTS idx_receitas_categoria ON public.receitas(categoria_codigo);
CREATE INDEX IF NOT EXISTS idx_receitas_empresa ON public.receitas(empresa_id);

-- ---------------------------------------------
-- RLS
-- ---------------------------------------------
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ler categorias_financeiras" ON public.categorias_financeiras;
CREATE POLICY "ler categorias_financeiras" ON public.categorias_financeiras
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "gerir categorias_financeiras" ON public.categorias_financeiras;
CREATE POLICY "gerir categorias_financeiras" ON public.categorias_financeiras
FOR ALL TO authenticated
USING (public.is_funcionario(auth.uid()) OR public.is_socio(auth.uid()))
WITH CHECK (public.is_funcionario(auth.uid()) OR public.is_socio(auth.uid()));

DROP POLICY IF EXISTS "gerir receitas" ON public.receitas;
CREATE POLICY "gerir receitas" ON public.receitas
FOR ALL TO authenticated
USING (public.is_funcionario(auth.uid()) OR public.is_socio(auth.uid()))
WITH CHECK (public.is_funcionario(auth.uid()) OR public.is_socio(auth.uid()));
