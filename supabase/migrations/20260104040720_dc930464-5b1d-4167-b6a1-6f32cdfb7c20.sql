-- =============================================
-- CRIAR TABELAS FALTANTES DO MÓDULO MARKETING
-- =============================================

-- UTMs (se não existir)
CREATE TABLE IF NOT EXISTS public.utms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utm_source varchar NOT NULL,
  utm_medium varchar,
  utm_campaign varchar,
  utm_content varchar,
  utm_term varchar,
  url_destino text NOT NULL,
  url_completa text,
  url_curta varchar,
  campanha_id uuid REFERENCES campanhas(id) ON DELETE SET NULL,
  cliques integer DEFAULT 0,
  leads_gerados integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Materiais Marketing (se não existir)
CREATE TABLE IF NOT EXISTS public.materiais_marketing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar NOT NULL,
  tipo varchar NOT NULL,
  arquivo_url text,
  thumbnail_url text,
  largura integer,
  altura integer,
  formato varchar,
  campanha_id uuid REFERENCES campanhas(id) ON DELETE SET NULL,
  downloads integer DEFAULT 0,
  status varchar DEFAULT 'ativo',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Distribuição Leads Config
CREATE TABLE IF NOT EXISTS public.distribuicao_leads_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo varchar NOT NULL DEFAULT 'round_robin',
  proximo_vendedor integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Distribuição Leads Vendedores
CREATE TABLE IF NOT EXISTS public.distribuicao_leads_vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  max_leads_dia integer,
  max_leads_mes integer,
  leads_recebidos_hoje integer DEFAULT 0,
  leads_recebidos_mes integer DEFAULT 0,
  taxa_conversao numeric DEFAULT 0,
  recebendo_leads boolean DEFAULT true,
  regioes text[],
  canais text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- HABILITAR RLS
-- =============================================
ALTER TABLE public.utms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuicao_leads_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuicao_leads_vendedores ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES PARA MÓDULO MARKETING
-- =============================================

-- CANAIS MARKETING
DROP POLICY IF EXISTS "canais_select_funcionario" ON canais_marketing;
DROP POLICY IF EXISTS "canais_all_marketing" ON canais_marketing;

CREATE POLICY "canais_select_funcionario" ON canais_marketing FOR SELECT
USING (is_funcionario(auth.uid()));

CREATE POLICY "canais_all_marketing" ON canais_marketing FOR ALL
USING (can_manage_marketing(auth.uid()));

-- CAMPANHAS MÉTRICAS  
DROP POLICY IF EXISTS "metricas_select_funcionario" ON campanhas_metricas;
DROP POLICY IF EXISTS "metricas_all_marketing" ON campanhas_metricas;

CREATE POLICY "metricas_select_funcionario" ON campanhas_metricas FOR SELECT
USING (is_funcionario(auth.uid()));

CREATE POLICY "metricas_all_marketing" ON campanhas_metricas FOR ALL
USING (can_manage_marketing(auth.uid()));

-- UTMs
DROP POLICY IF EXISTS "utms_select_funcionario" ON utms;
DROP POLICY IF EXISTS "utms_all_funcionario" ON utms;

CREATE POLICY "utms_select_funcionario" ON utms FOR SELECT
USING (is_funcionario(auth.uid()));

CREATE POLICY "utms_all_funcionario" ON utms FOR ALL
USING (is_funcionario(auth.uid()));

-- MATERIAIS MARKETING
DROP POLICY IF EXISTS "materiais_select_funcionario" ON materiais_marketing;
DROP POLICY IF EXISTS "materiais_all_funcionario" ON materiais_marketing;

CREATE POLICY "materiais_select_funcionario" ON materiais_marketing FOR SELECT
USING (is_funcionario(auth.uid()));

CREATE POLICY "materiais_all_funcionario" ON materiais_marketing FOR ALL
USING (is_funcionario(auth.uid()));

-- PROGRAMA INDICAÇÃO
DROP POLICY IF EXISTS "programa_select_all" ON programa_indicacao;
DROP POLICY IF EXISTS "programa_modify_marketing" ON programa_indicacao;

CREATE POLICY "programa_select_all" ON programa_indicacao FOR SELECT
USING (true);

CREATE POLICY "programa_modify_marketing" ON programa_indicacao FOR ALL
USING (can_manage_marketing(auth.uid()));

-- INDICAÇÕES - adicionar select para associado ver suas próprias
DROP POLICY IF EXISTS "indicacoes_select_own" ON indicacoes;
CREATE POLICY "indicacoes_select_own" ON indicacoes FOR SELECT
USING (
  is_funcionario(auth.uid())
  OR indicador_id = get_my_associado_id(auth.uid())
);

-- DISTRIBUIÇÃO LEADS CONFIG
DROP POLICY IF EXISTS "distribuicao_config_select" ON distribuicao_leads_config;
DROP POLICY IF EXISTS "distribuicao_config_all" ON distribuicao_leads_config;

CREATE POLICY "distribuicao_config_select" ON distribuicao_leads_config FOR SELECT
USING (is_funcionario(auth.uid()));

CREATE POLICY "distribuicao_config_all" ON distribuicao_leads_config FOR ALL
USING (can_manage_marketing(auth.uid()));

-- DISTRIBUIÇÃO LEADS VENDEDORES
DROP POLICY IF EXISTS "distribuicao_vendedores_select" ON distribuicao_leads_vendedores;
DROP POLICY IF EXISTS "distribuicao_vendedores_all" ON distribuicao_leads_vendedores;

CREATE POLICY "distribuicao_vendedores_select" ON distribuicao_leads_vendedores FOR SELECT
USING (is_funcionario(auth.uid()));

CREATE POLICY "distribuicao_vendedores_all" ON distribuicao_leads_vendedores FOR ALL
USING (can_manage_marketing(auth.uid()));