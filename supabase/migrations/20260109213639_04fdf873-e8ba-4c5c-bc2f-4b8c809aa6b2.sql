-- =====================================================
-- FASE 1: Ajustar tabela PLANOS com novos campos
-- =====================================================

-- Adicionar novos campos à tabela planos
ALTER TABLE public.planos 
ADD COLUMN IF NOT EXISTS linha VARCHAR(50),
ADD COLUMN IF NOT EXISTS nivel VARCHAR(50),
ADD COLUMN IF NOT EXISTS cobertura_fipe INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS cota_participacao DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS cota_minima DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS cota_desagio DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS cota_minima_desagio DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS adicional_mensal DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ano_minimo_veiculo INTEGER,
ADD COLUMN IF NOT EXISTS categoria VARCHAR(20),
ADD COLUMN IF NOT EXISTS ordem_exibicao INTEGER DEFAULT 0;

-- =====================================================
-- FASE 2: Criar tabela PLANOS_BENEFICIOS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.planos_beneficios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  beneficio VARCHAR(100) NOT NULL,
  descricao TEXT,
  incluso BOOLEAN DEFAULT TRUE,
  observacao TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca por plano
CREATE INDEX IF NOT EXISTS idx_planos_beneficios_plano_id ON public.planos_beneficios(plano_id);

-- =====================================================
-- FASE 3: Adicionar coluna REGIAO à tabela de preços
-- =====================================================

ALTER TABLE public.tabelas_preco 
ADD COLUMN IF NOT EXISTS regiao VARCHAR(50) DEFAULT 'RJ';

-- Índice para busca por região
CREATE INDEX IF NOT EXISTS idx_tabelas_preco_regiao ON public.tabelas_preco(regiao);

-- =====================================================
-- FASE 4: Criar tabela PLANOS_RESTRICOES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.planos_restricoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  categoria_veiculo VARCHAR(100) NOT NULL,
  tipo_restricao VARCHAR(50) NOT NULL,
  cobertura_removida VARCHAR(100),
  mensagem_alerta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca por plano e categoria
CREATE INDEX IF NOT EXISTS idx_planos_restricoes_plano_id ON public.planos_restricoes(plano_id);
CREATE INDEX IF NOT EXISTS idx_planos_restricoes_categoria ON public.planos_restricoes(categoria_veiculo);

-- =====================================================
-- FASE 5: RLS - Políticas de Segurança
-- =====================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.planos_beneficios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos_restricoes ENABLE ROW LEVEL SECURITY;

-- Políticas para planos_beneficios (leitura pública para usuários autenticados)
CREATE POLICY "Authenticated users can view planos_beneficios"
ON public.planos_beneficios
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Gerencia can manage planos_beneficios"
ON public.planos_beneficios
FOR ALL
TO authenticated
USING (public.is_gerencia(auth.uid()))
WITH CHECK (public.is_gerencia(auth.uid()));

-- Políticas para planos_restricoes (leitura pública para usuários autenticados)
CREATE POLICY "Authenticated users can view planos_restricoes"
ON public.planos_restricoes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Gerencia can manage planos_restricoes"
ON public.planos_restricoes
FOR ALL
TO authenticated
USING (public.is_gerencia(auth.uid()))
WITH CHECK (public.is_gerencia(auth.uid()));