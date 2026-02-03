-- ============================================
-- SISTEMA DE COBRANÇA PÓS-PAGO COM RATEIO
-- ============================================

-- 1. TABELA: fechamentos_mensais
-- Registra o fechamento de cada período com totais apurados
CREATE TABLE IF NOT EXISTS public.fechamentos_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL CHECK (ano >= 2024),
  data_fechamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado', 'aprovado', 'processado')),
  
  -- Totais apurados
  total_associados_ativos INTEGER DEFAULT 0,
  total_cotas_ativas NUMERIC(12,2) DEFAULT 0,
  total_despesas_rateio NUMERIC(14,2) DEFAULT 0,
  total_taxa_administrativa NUMERIC(14,2) DEFAULT 0,
  total_adicionais NUMERIC(14,2) DEFAULT 0,
  total_geral NUMERIC(14,2) DEFAULT 0,
  
  -- Auditoria
  fechado_por UUID REFERENCES profiles(id),
  fechado_em TIMESTAMP WITH TIME ZONE,
  aprovado_por UUID REFERENCES profiles(id),
  aprovado_em TIMESTAMP WITH TIME ZONE,
  processado_por UUID REFERENCES profiles(id),
  processado_em TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(mes, ano)
);

-- Comentários
COMMENT ON TABLE public.fechamentos_mensais IS 'Registro de fechamentos mensais para cálculo de rateio pós-pago';
COMMENT ON COLUMN public.fechamentos_mensais.status IS 'aberto=acumulando, fechado=consolidado, aprovado=rateio calculado, processado=boletos gerados';

-- 2. TABELA: despesas_rateio
-- Armazena despesas a ratear agrupadas por tipo de benefício
CREATE TABLE IF NOT EXISTS public.despesas_rateio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id UUID NOT NULL REFERENCES fechamentos_mensais(id) ON DELETE CASCADE,
  
  tipo_beneficio VARCHAR(50) NOT NULL, -- colisao, roubo_furto, vidros, terceiros, assistencia, incendio
  descricao TEXT,
  
  -- Valores
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_cotas_elegivel NUMERIC(12,2) DEFAULT 0, -- soma de cotas dos que têm este benefício
  valor_por_cota NUMERIC(12,4) DEFAULT 0, -- valor_total / total_cotas_elegivel
  
  -- Sinistros vinculados
  quantidade_eventos INTEGER DEFAULT 0,
  sinistros_ids UUID[] DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.despesas_rateio IS 'Despesas agrupadas por tipo de benefício para cálculo de rateio';

-- 3. TABELA: cobrancas_composicao
-- Detalha os componentes de cada cobrança individual
CREATE TABLE IF NOT EXISTS public.cobrancas_composicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id UUID NOT NULL REFERENCES asaas_cobrancas(id) ON DELETE CASCADE,
  
  -- Componentes da fatura
  valor_taxa_administrativa NUMERIC(10,2) DEFAULT 0,
  valor_rateio_colisao NUMERIC(10,2) DEFAULT 0,
  valor_rateio_roubo_furto NUMERIC(10,2) DEFAULT 0,
  valor_rateio_vidros NUMERIC(10,2) DEFAULT 0,
  valor_rateio_terceiros NUMERIC(10,2) DEFAULT 0,
  valor_rateio_assistencia NUMERIC(10,2) DEFAULT 0,
  valor_rateio_incendio NUMERIC(10,2) DEFAULT 0,
  valor_adicionais NUMERIC(10,2) DEFAULT 0, -- rastreador, app, etc.
  valor_adicionais_detalhes JSONB DEFAULT '{}',
  
  -- Proporcionalidade (pró-rata)
  fator_prorata NUMERIC(5,4) DEFAULT 1.0 CHECK (fator_prorata > 0 AND fator_prorata <= 1),
  dias_ativos INTEGER DEFAULT 30,
  data_inicio_vigencia DATE,
  data_fim_vigencia DATE,
  
  -- Dados do veículo no momento
  veiculo_id UUID REFERENCES veiculos(id),
  valor_fipe NUMERIC(14,2),
  quantidade_cotas INTEGER,
  faixa_id UUID REFERENCES faixas_cotas(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.cobrancas_composicao IS 'Composição detalhada de cada cobrança (Taxa + Rateio + Adicionais)';

-- 4. ALTERAÇÕES EM asaas_cobrancas
ALTER TABLE public.asaas_cobrancas
ADD COLUMN IF NOT EXISTS fechamento_id UUID REFERENCES fechamentos_mensais(id),
ADD COLUMN IF NOT EXISTS mes_referencia INTEGER,
ADD COLUMN IF NOT EXISTS ano_referencia INTEGER,
ADD COLUMN IF NOT EXISTS modelo_cobranca VARCHAR(20) DEFAULT 'fixo' CHECK (modelo_cobranca IN ('rateio', 'fixo')),
ADD COLUMN IF NOT EXISTS composicao_resumo JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS enviada_whatsapp BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS enviada_whatsapp_em TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.asaas_cobrancas.modelo_cobranca IS 'rateio=sistema pós-pago mutualista, fixo=mensalidade fixa';
COMMENT ON COLUMN public.asaas_cobrancas.composicao_resumo IS 'JSON com resumo da composição para exibição rápida';

-- 5. ALTERAÇÕES EM veiculos (cache de cotas)
ALTER TABLE public.veiculos
ADD COLUMN IF NOT EXISTS quantidade_cotas INTEGER,
ADD COLUMN IF NOT EXISTS faixa_cota_id UUID REFERENCES faixas_cotas(id),
ADD COLUMN IF NOT EXISTS valor_fipe_cache NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS valor_fipe_atualizado_em TIMESTAMP WITH TIME ZONE;

-- 6. ÍNDICES para performance
CREATE INDEX IF NOT EXISTS idx_fechamentos_mes_ano ON public.fechamentos_mensais(mes, ano);
CREATE INDEX IF NOT EXISTS idx_fechamentos_status ON public.fechamentos_mensais(status);
CREATE INDEX IF NOT EXISTS idx_despesas_rateio_fechamento ON public.despesas_rateio(fechamento_id);
CREATE INDEX IF NOT EXISTS idx_despesas_rateio_tipo ON public.despesas_rateio(tipo_beneficio);
CREATE INDEX IF NOT EXISTS idx_cobrancas_composicao_cobranca ON public.cobrancas_composicao(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_fechamento ON public.asaas_cobrancas(fechamento_id);
CREATE INDEX IF NOT EXISTS idx_asaas_cobrancas_mes_ref ON public.asaas_cobrancas(mes_referencia, ano_referencia);

-- 7. RLS POLICIES

-- fechamentos_mensais
ALTER TABLE public.fechamentos_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretoria pode ver fechamentos"
  ON public.fechamentos_mensais FOR SELECT
  USING (public.is_diretor_for_crud(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "Diretoria pode criar fechamentos"
  ON public.fechamentos_mensais FOR INSERT
  WITH CHECK (public.is_diretor_for_crud(auth.uid()));

CREATE POLICY "Diretoria pode atualizar fechamentos"
  ON public.fechamentos_mensais FOR UPDATE
  USING (public.is_diretor_for_crud(auth.uid()));

-- despesas_rateio
ALTER TABLE public.despesas_rateio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretoria pode ver despesas"
  ON public.despesas_rateio FOR SELECT
  USING (public.is_diretor_for_crud(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "Sistema pode inserir despesas"
  ON public.despesas_rateio FOR INSERT
  WITH CHECK (public.is_diretor_for_crud(auth.uid()));

CREATE POLICY "Sistema pode atualizar despesas"
  ON public.despesas_rateio FOR UPDATE
  USING (public.is_diretor_for_crud(auth.uid()));

-- cobrancas_composicao
ALTER TABLE public.cobrancas_composicao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionários podem ver composição"
  ON public.cobrancas_composicao FOR SELECT
  USING (public.is_funcionario(auth.uid()));

CREATE POLICY "Sistema pode inserir composição"
  ON public.cobrancas_composicao FOR INSERT
  WITH CHECK (public.is_diretor_for_crud(auth.uid()));

-- 8. TRIGGER para updated_at
CREATE OR REPLACE FUNCTION public.update_fechamentos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_fechamentos_updated_at
  BEFORE UPDATE ON public.fechamentos_mensais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fechamentos_updated_at();

-- 9. FUNÇÃO para calcular rateio por benefício
CREATE OR REPLACE FUNCTION public.fn_calcular_valor_por_cota_beneficio(
  p_fechamento_id UUID,
  p_tipo_beneficio VARCHAR
)
RETURNS TABLE(
  valor_total NUMERIC,
  total_cotas NUMERIC,
  valor_por_cota NUMERIC,
  quantidade_associados INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes INTEGER;
  v_ano INTEGER;
  v_valor_total NUMERIC := 0;
  v_total_cotas NUMERIC := 0;
  v_qtd_associados INTEGER := 0;
BEGIN
  -- Buscar período do fechamento
  SELECT f.mes, f.ano INTO v_mes, v_ano
  FROM fechamentos_mensais f
  WHERE f.id = p_fechamento_id;

  -- Somar despesas/sinistros do período para este benefício
  SELECT COALESCE(SUM(s.valor_indenizacao), 0)
  INTO v_valor_total
  FROM sinistros s
  WHERE s.status IN ('aprovado', 'indenizado', 'pago')
    AND EXTRACT(MONTH FROM s.data_ocorrencia) = v_mes
    AND EXTRACT(YEAR FROM s.data_ocorrencia) = v_ano
    AND (
      (p_tipo_beneficio = 'colisao' AND s.tipo IN ('colisao_parcial', 'colisao_total', 'colisao'))
      OR (p_tipo_beneficio = 'roubo_furto' AND s.tipo IN ('roubo', 'furto', 'roubo_furto'))
      OR (p_tipo_beneficio = 'incendio' AND s.tipo = 'incendio')
      OR (p_tipo_beneficio = 'vidros' AND s.tipo = 'vidros')
      OR (p_tipo_beneficio = 'terceiros' AND s.tipo = 'terceiros')
    );

  -- Contar cotas dos associados que têm esse benefício ativo
  SELECT 
    COALESCE(SUM(COALESCE(v.quantidade_cotas, fc.quantidade_cotas, 1)), 0),
    COUNT(DISTINCT a.id)
  INTO v_total_cotas, v_qtd_associados
  FROM associados a
  JOIN veiculos v ON v.associado_id = a.id AND v.status = 'ativo'
  LEFT JOIN faixas_cotas fc ON v.faixa_cota_id = fc.id
  WHERE a.status = 'ativo'
    AND (
      (p_tipo_beneficio = 'colisao' AND v.cobertura_total = true)
      OR (p_tipo_beneficio = 'roubo_furto' AND (v.cobertura_roubo_furto = true OR v.cobertura_total = true))
      OR (p_tipo_beneficio = 'incendio' AND v.cobertura_total = true)
      -- vidros e terceiros: verificar via plano/contrato
      OR (p_tipo_beneficio IN ('vidros', 'terceiros') AND v.cobertura_total = true)
    );

  RETURN QUERY SELECT 
    v_valor_total,
    v_total_cotas,
    CASE WHEN v_total_cotas > 0 THEN v_valor_total / v_total_cotas ELSE 0 END,
    v_qtd_associados;
END;
$$;

COMMENT ON FUNCTION public.fn_calcular_valor_por_cota_beneficio IS 'Calcula o valor por cota para um tipo específico de benefício em um fechamento';

-- 10. FUNÇÃO para calcular pró-rata
CREATE OR REPLACE FUNCTION public.fn_calcular_prorata(
  p_data_adesao DATE,
  p_data_saida DATE,
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_inicio_mes DATE;
  v_fim_mes DATE;
  v_dias_mes INTEGER;
  v_data_inicio DATE;
  v_data_fim DATE;
  v_dias_ativos INTEGER;
BEGIN
  v_inicio_mes := make_date(p_ano, p_mes, 1);
  v_fim_mes := (v_inicio_mes + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_dias_mes := EXTRACT(DAY FROM v_fim_mes);
  
  -- Data efetiva de início (maior entre adesão e início do mês)
  v_data_inicio := GREATEST(COALESCE(p_data_adesao, v_inicio_mes), v_inicio_mes);
  
  -- Data efetiva de fim (menor entre saída e fim do mês)
  v_data_fim := LEAST(COALESCE(p_data_saida, v_fim_mes), v_fim_mes);
  
  -- Calcular dias ativos
  v_dias_ativos := v_data_fim - v_data_inicio + 1;
  
  -- Retornar fator pró-rata (entre 0 e 1)
  RETURN GREATEST(0, LEAST(1, v_dias_ativos::NUMERIC / v_dias_mes));
END;
$$;

COMMENT ON FUNCTION public.fn_calcular_prorata IS 'Calcula fator pró-rata para cobranças de associados que entraram/saíram durante o mês';