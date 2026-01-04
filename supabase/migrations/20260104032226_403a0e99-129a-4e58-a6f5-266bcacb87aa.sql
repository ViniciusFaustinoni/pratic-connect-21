
-- =============================================
-- MÓDULO MARKETING - TABELAS
-- =============================================

-- CANAIS DE AQUISIÇÃO
CREATE TABLE IF NOT EXISTS canais_marketing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
        'organico', 'pago', 'referral', 'direto', 'social', 'email', 'offline'
    )),
    descricao TEXT,
    custo_por_lead DECIMAL(10,2),
    meta_leads_mes INTEGER,
    webhook_url VARCHAR(500),
    api_key VARCHAR(255),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CAMPANHAS DE MARKETING
CREATE TABLE IF NOT EXISTS campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(30) UNIQUE,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
        'aquisicao', 'reativacao', 'indicacao', 'branding', 
        'promocional', 'sazonal', 'remarketing'
    )),
    canal_id UUID REFERENCES canais_marketing(id),
    data_inicio DATE NOT NULL,
    data_fim DATE,
    orcamento_total DECIMAL(12,2),
    orcamento_diario DECIMAL(10,2),
    valor_gasto DECIMAL(12,2) DEFAULT 0,
    meta_leads INTEGER,
    meta_conversoes INTEGER,
    meta_cpl DECIMAL(10,2),
    publico_alvo TEXT,
    regioes TEXT[],
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    utm_term VARCHAR(100),
    status VARCHAR(20) DEFAULT 'rascunho' CHECK (status IN (
        'rascunho', 'agendada', 'ativa', 'pausada', 'finalizada', 'cancelada'
    )),
    responsavel_id UUID REFERENCES profiles(id),
    criado_por UUID REFERENCES profiles(id),
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MÉTRICAS DIÁRIAS DA CAMPANHA
CREATE TABLE IF NOT EXISTS campanhas_metricas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campanha_id UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    valor_gasto DECIMAL(10,2) DEFAULT 0,
    impressoes INTEGER DEFAULT 0,
    cliques INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    conversoes INTEGER DEFAULT 0,
    ctr DECIMAL(5,2),
    cpl DECIMAL(10,2),
    cpa DECIMAL(10,2),
    taxa_conversao DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campanha_id, data)
);

-- UTMs (RASTREAMENTO DE ORIGEM)
CREATE TABLE IF NOT EXISTS utms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utm_source VARCHAR(100) NOT NULL,
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    utm_term VARCHAR(100),
    url_destino VARCHAR(500) NOT NULL,
    url_completa VARCHAR(1000),
    url_curta VARCHAR(100),
    campanha_id UUID REFERENCES campanhas(id),
    cliques INTEGER DEFAULT 0,
    leads_gerados INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    criado_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROGRAMA DE INDICAÇÕES
CREATE TABLE IF NOT EXISTS programa_indicacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    valor_indicador DECIMAL(10,2) NOT NULL,
    valor_indicado DECIMAL(10,2),
    tipo_recompensa VARCHAR(20) CHECK (tipo_recompensa IN (
        'dinheiro', 'desconto', 'credito', 'brinde'
    )),
    limite_indicacoes_mes INTEGER,
    prazo_validade_dias INTEGER DEFAULT 30,
    condicao_pagamento VARCHAR(50) CHECK (condicao_pagamento IN (
        'cadastro_aprovado', 'primeira_mensalidade', 'terceira_mensalidade'
    )),
    ativo BOOLEAN DEFAULT true,
    data_inicio DATE,
    data_fim DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDICAÇÕES REALIZADAS
CREATE TABLE IF NOT EXISTS indicacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(20) UNIQUE,
    programa_id UUID REFERENCES programa_indicacao(id),
    indicador_id UUID REFERENCES associados(id),
    indicador_nome VARCHAR(255),
    indicador_telefone VARCHAR(20),
    indicado_nome VARCHAR(255) NOT NULL,
    indicado_telefone VARCHAR(20) NOT NULL,
    indicado_email VARCHAR(255),
    lead_id UUID REFERENCES leads(id),
    associado_id UUID REFERENCES associados(id),
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN (
        'pendente', 'contatado', 'convertido', 'recompensado', 
        'expirado', 'cancelado'
    )),
    valor_recompensa DECIMAL(10,2),
    data_recompensa DATE,
    recompensa_paga BOOLEAN DEFAULT false,
    data_indicacao TIMESTAMPTZ DEFAULT NOW(),
    data_contato TIMESTAMPTZ,
    data_conversao TIMESTAMPTZ,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DISTRIBUIÇÃO DE LEADS CONFIG
CREATE TABLE IF NOT EXISTS distribuicao_leads_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN (
        'round_robin', 'por_regiao', 'por_canal', 'por_performance', 'manual'
    )),
    ativo BOOLEAN DEFAULT true,
    vendedores_ordem UUID[],
    proximo_vendedor INTEGER DEFAULT 0,
    regras_regiao JSONB,
    regras_canal JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DISTRIBUIÇÃO DE LEADS POR VENDEDOR
CREATE TABLE IF NOT EXISTS distribuicao_leads_vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID NOT NULL REFERENCES profiles(id),
    max_leads_dia INTEGER DEFAULT 10,
    max_leads_mes INTEGER DEFAULT 200,
    leads_recebidos_hoje INTEGER DEFAULT 0,
    leads_recebidos_mes INTEGER DEFAULT 0,
    regioes TEXT[],
    canais UUID[],
    taxa_conversao DECIMAL(5,2),
    ticket_medio DECIMAL(10,2),
    recebendo_leads BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendedor_id)
);

-- LANDING PAGES
CREATE TABLE IF NOT EXISTS landing_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    url VARCHAR(500),
    url_preview VARCHAR(500),
    campanha_id UUID REFERENCES campanhas(id),
    visitas INTEGER DEFAULT 0,
    conversoes INTEGER DEFAULT 0,
    taxa_conversao DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'rascunho' CHECK (status IN (
        'rascunho', 'publicada', 'pausada', 'arquivada'
    )),
    criado_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MATERIAIS DE MARKETING
CREATE TABLE IF NOT EXISTS materiais_marketing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
        'banner', 'video', 'post_social', 'email', 'pdf',
        'apresentacao', 'folder', 'cartao', 'outro'
    )),
    arquivo_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    largura INTEGER,
    altura INTEGER,
    formato VARCHAR(20),
    campanha_id UUID REFERENCES campanhas(id),
    downloads INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN (
        'ativo', 'inativo', 'arquivado'
    )),
    criado_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADICIONAR CAMPOS UTM NA TABELA DE LEADS
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campanha_id UUID REFERENCES campanhas(id);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_campanhas_status ON campanhas(status);
CREATE INDEX IF NOT EXISTS idx_campanhas_periodo ON campanhas(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_campanhas_metricas_data ON campanhas_metricas(campanha_id, data);
CREATE INDEX IF NOT EXISTS idx_utms_campanha ON utms(campanha_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador ON indicacoes(indicador_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_status ON indicacoes(status);
CREATE INDEX IF NOT EXISTS idx_leads_utm ON leads(utm_source, utm_campaign);

-- FUNÇÃO PARA GERAR CÓDIGO DA CAMPANHA
CREATE OR REPLACE FUNCTION gerar_codigo_campanha()
RETURNS TRIGGER AS $$
DECLARE
  seq INTEGER;
  periodo VARCHAR(6);
BEGIN
  periodo := TO_CHAR(CURRENT_DATE, 'YYYYMM');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 13 FOR 3) AS INTEGER)), 0) + 1
  INTO seq
  FROM campanhas
  WHERE codigo LIKE 'CAMP-' || periodo || '-%';
  
  NEW.codigo := 'CAMP-' || periodo || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_gerar_codigo_campanha ON campanhas;
CREATE TRIGGER trigger_gerar_codigo_campanha
  BEFORE INSERT ON campanhas
  FOR EACH ROW
  WHEN (NEW.codigo IS NULL)
  EXECUTE FUNCTION gerar_codigo_campanha();

-- FUNÇÃO PARA GERAR CÓDIGO DA INDICAÇÃO
CREATE OR REPLACE FUNCTION gerar_codigo_indicacao()
RETURNS TRIGGER AS $$
DECLARE
  seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 5 FOR 5) AS INTEGER)), 0) + 1
  INTO seq
  FROM indicacoes;
  
  NEW.codigo := 'IND-' || LPAD(seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_gerar_codigo_indicacao ON indicacoes;
CREATE TRIGGER trigger_gerar_codigo_indicacao
  BEFORE INSERT ON indicacoes
  FOR EACH ROW
  WHEN (NEW.codigo IS NULL)
  EXECUTE FUNCTION gerar_codigo_indicacao();

-- TRIGGER PARA CALCULAR MÉTRICAS
CREATE OR REPLACE FUNCTION calcular_metricas_campanha()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.impressoes > 0 THEN
    NEW.ctr := (NEW.cliques::DECIMAL / NEW.impressoes) * 100;
  END IF;
  
  IF NEW.leads > 0 THEN
    NEW.cpl := NEW.valor_gasto / NEW.leads;
  END IF;
  
  IF NEW.conversoes > 0 THEN
    NEW.cpa := NEW.valor_gasto / NEW.conversoes;
  END IF;
  
  IF NEW.leads > 0 THEN
    NEW.taxa_conversao := (NEW.conversoes::DECIMAL / NEW.leads) * 100;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_calcular_metricas ON campanhas_metricas;
CREATE TRIGGER trigger_calcular_metricas
  BEFORE INSERT OR UPDATE ON campanhas_metricas
  FOR EACH ROW
  EXECUTE FUNCTION calcular_metricas_campanha();

-- FUNÇÃO DE PERMISSÃO MARKETING
CREATE OR REPLACE FUNCTION can_manage_marketing(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('diretor', 'gerente_comercial', 'analista_marketing')
  )
$$;

-- RLS POLICIES
ALTER TABLE canais_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas_metricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE utms ENABLE ROW LEVEL SECURITY;
ALTER TABLE programa_indicacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribuicao_leads_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribuicao_leads_vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_marketing ENABLE ROW LEVEL SECURITY;

-- Canais
CREATE POLICY "canais_select_funcionario" ON canais_marketing FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "canais_all_marketing" ON canais_marketing FOR ALL USING (can_manage_marketing(auth.uid()));

-- Campanhas
CREATE POLICY "campanhas_select_funcionario" ON campanhas FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "campanhas_all_marketing" ON campanhas FOR ALL USING (can_manage_marketing(auth.uid()));

-- Métricas
CREATE POLICY "metricas_select_funcionario" ON campanhas_metricas FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "metricas_all_marketing" ON campanhas_metricas FOR ALL USING (can_manage_marketing(auth.uid()));

-- UTMs
CREATE POLICY "utms_select_funcionario" ON utms FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "utms_all_marketing" ON utms FOR ALL USING (can_manage_marketing(auth.uid()));

-- Programa Indicação
CREATE POLICY "programa_select_all" ON programa_indicacao FOR SELECT USING (true);
CREATE POLICY "programa_all_marketing" ON programa_indicacao FOR ALL USING (can_manage_marketing(auth.uid()));

-- Indicações
CREATE POLICY "indicacoes_select_funcionario" ON indicacoes FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "indicacoes_select_indicador" ON indicacoes FOR SELECT USING (indicador_id = get_my_associado_id(auth.uid()));
CREATE POLICY "indicacoes_insert_associado" ON indicacoes FOR INSERT WITH CHECK (indicador_id = get_my_associado_id(auth.uid()));
CREATE POLICY "indicacoes_all_marketing" ON indicacoes FOR ALL USING (can_manage_marketing(auth.uid()));

-- Distribuição Config
CREATE POLICY "distrib_config_select_funcionario" ON distribuicao_leads_config FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "distrib_config_all_marketing" ON distribuicao_leads_config FOR ALL USING (can_manage_marketing(auth.uid()));

-- Distribuição Vendedores
CREATE POLICY "distrib_vend_select_funcionario" ON distribuicao_leads_vendedores FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "distrib_vend_all_marketing" ON distribuicao_leads_vendedores FOR ALL USING (can_manage_marketing(auth.uid()));

-- Landing Pages
CREATE POLICY "lp_select_funcionario" ON landing_pages FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "lp_all_marketing" ON landing_pages FOR ALL USING (can_manage_marketing(auth.uid()));

-- Materiais
CREATE POLICY "materiais_select_funcionario" ON materiais_marketing FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "materiais_all_marketing" ON materiais_marketing FOR ALL USING (can_manage_marketing(auth.uid()));

-- VIEW DE PERFORMANCE POR CANAL (com cast correto para enum)
CREATE OR REPLACE VIEW view_performance_canais AS
SELECT 
    c.id,
    c.nome,
    c.tipo,
    COUNT(DISTINCT l.id) as total_leads,
    COUNT(DISTINCT CASE WHEN l.etapa::text = 'ganho' THEN l.id END) as conversoes,
    CASE 
        WHEN COUNT(l.id) > 0 
        THEN (COUNT(CASE WHEN l.etapa::text = 'ganho' THEN 1 END)::DECIMAL / COUNT(l.id)) * 100 
        ELSE 0 
    END as taxa_conversao,
    COALESCE(SUM(cm.valor_gasto), 0) as investimento_total,
    CASE 
        WHEN COUNT(l.id) > 0 
        THEN COALESCE(SUM(cm.valor_gasto), 0) / COUNT(l.id) 
        ELSE 0 
    END as cpl_medio
FROM canais_marketing c
LEFT JOIN campanhas camp ON camp.canal_id = c.id
LEFT JOIN leads l ON l.origem::text = c.nome OR l.utm_source = c.nome
LEFT JOIN campanhas_metricas cm ON cm.campanha_id = camp.id
WHERE c.ativo = true
GROUP BY c.id, c.nome, c.tipo
ORDER BY total_leads DESC;

-- VIEW DE INDICAÇÕES PENDENTES DE PAGAMENTO
CREATE OR REPLACE VIEW view_indicacoes_pendentes AS
SELECT 
    i.*,
    a.nome as indicador_nome_completo,
    a.telefone as indicador_telefone_completo,
    p.nome as programa_nome,
    p.valor_indicador
FROM indicacoes i
LEFT JOIN associados a ON a.id = i.indicador_id
LEFT JOIN programa_indicacao p ON p.id = i.programa_id
WHERE i.status = 'convertido' 
  AND i.recompensa_paga = false
ORDER BY i.data_conversao;
