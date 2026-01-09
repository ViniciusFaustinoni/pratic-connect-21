-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  RAIO-X SQL — TABELAS PARA JORNADA DO ASSOCIADO                  ║
-- ║  Sistema: SGA PRATIC 2.0 / PraticCar                             ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════
-- 1. TABELA: cotacoes_publicas (Jornada Pública do Cliente)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cotacoes_publicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES public.profiles(id),
  
  -- Status da jornada
  status VARCHAR(50) DEFAULT 'aguardando' CHECK (status IN (
    'aguardando',
    'visualizado',
    'uso_definido',
    'plano_escolhido',
    'proposta_aceita',
    'documentos_enviados',
    'selfie_pendente',
    'selfie_ok',
    'selfie_falhou',
    'vistoria_pendente',
    'vistoria_agendada',
    'vistoria_concluida',
    'termos_pendentes',
    'termos_assinados',
    'analise_pendente',
    'analise_aprovada',
    'pagamento_pendente',
    'rastreador_pendente',
    'rastreador_agendado',
    'rastreador_instalado',
    'concluido',
    'recusado',
    'expirado',
    'cancelado'
  )),
  
  -- Veículo
  veiculo_marca VARCHAR(100),
  veiculo_modelo VARCHAR(100),
  veiculo_ano INTEGER,
  veiculo_placa VARCHAR(10),
  veiculo_cor VARCHAR(50),
  veiculo_combustivel VARCHAR(30),
  valor_fipe DECIMAL(12,2),
  codigo_fipe VARCHAR(20),
  
  -- Escolhas do cliente
  uso_aplicativo BOOLEAN,
  plano_escolhido VARCHAR(50),
  adicionais_selecionados JSONB DEFAULT '[]',
  valor_mensal_final DECIMAL(10,2),
  valor_adesao_final DECIMAL(10,2),
  valor_primeira_parcela DECIMAL(10,2),
  
  -- Documentos (URLs)
  doc_cnh_frente TEXT,
  doc_cnh_verso TEXT,
  doc_crlv TEXT,
  doc_comprovante TEXT,
  doc_selfie TEXT,
  
  -- Dados extraídos (OCR)
  dados_cnh JSONB,
  dados_crlv JSONB,
  dados_comprovante JSONB,
  
  -- Verificação facial
  face_match_score DECIMAL(5,2),
  face_aprovada BOOLEAN,
  face_verificada_em TIMESTAMPTZ,
  
  -- Vistoria
  tipo_vistoria VARCHAR(30) CHECK (tipo_vistoria IN ('autoatendimento', 'tecnico')),
  vistoria_agendada_para TIMESTAMPTZ,
  vistoria_endereco TEXT,
  vistoria_concluida_em TIMESTAMPTZ,
  vistoria_observacoes TEXT,
  
  -- Termos
  termos_aceitos BOOLEAN DEFAULT false,
  termos_aceitos_em TIMESTAMPTZ,
  
  -- Pagamento (Asaas)
  pagamento_status VARCHAR(30),
  pagamento_metodo VARCHAR(30),
  asaas_customer_id VARCHAR(50),
  asaas_charge_id VARCHAR(50),
  asaas_boleto_url TEXT,
  asaas_pix_qrcode TEXT,
  asaas_pix_copiacola TEXT,
  pagamento_confirmado_em TIMESTAMPTZ,
  
  -- Rastreador
  rastreador_agendado_para TIMESTAMPTZ,
  rastreador_instalado_em TIMESTAMPTZ,
  rastreador_id VARCHAR(50),
  
  -- Pendências
  pendencias JSONB DEFAULT '[]',
  pendencias_observacoes TEXT,
  
  -- Metadados
  user_agent TEXT,
  ip_address VARCHAR(45),
  
  -- Timestamps de controle
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  visualizado_em TIMESTAMPTZ,
  uso_definido_em TIMESTAMPTZ,
  plano_escolhido_em TIMESTAMPTZ,
  proposta_aceita_em TIMESTAMPTZ,
  documentos_ok_em TIMESTAMPTZ,
  selfie_ok_em TIMESTAMPTZ,
  vistoria_ok_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cotacoes_publicas_token ON public.cotacoes_publicas(token);
CREATE INDEX IF NOT EXISTS idx_cotacoes_publicas_lead ON public.cotacoes_publicas(lead_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_publicas_status ON public.cotacoes_publicas(status);
CREATE INDEX IF NOT EXISTS idx_cotacoes_publicas_vendedor ON public.cotacoes_publicas(vendedor_id);

-- ════════════════════════════════════════════════════════════════════
-- 2. TABELA: cotacoes_publicas_fotos (Fotos da Vistoria)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cotacoes_publicas_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID NOT NULL REFERENCES public.cotacoes_publicas(id) ON DELETE CASCADE,
  
  tipo VARCHAR(50) NOT NULL,
  descricao VARCHAR(100),
  url TEXT NOT NULL,
  
  -- Geolocalização
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  
  -- Validação
  aprovada BOOLEAN,
  motivo_rejeicao TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotacoes_publicas_fotos_cotacao ON public.cotacoes_publicas_fotos(cotacao_id);

-- ════════════════════════════════════════════════════════════════════
-- 3. TABELA: cotacoes_publicas_historico (Log de Ações)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cotacoes_publicas_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID NOT NULL REFERENCES public.cotacoes_publicas(id) ON DELETE CASCADE,
  
  acao VARCHAR(100) NOT NULL,
  status_anterior VARCHAR(50),
  status_novo VARCHAR(50),
  detalhes JSONB,
  
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotacoes_publicas_historico_cotacao ON public.cotacoes_publicas_historico(cotacao_id);

-- ════════════════════════════════════════════════════════════════════
-- 4. TABELA: tabelas_preco_mensalidade (Preços Mensais por FIPE)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tabelas_preco_mensalidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  tipo_uso VARCHAR(20) NOT NULL CHECK (tipo_uso IN ('particular', 'aplicativo')),
  categoria VARCHAR(20) NOT NULL CHECK (categoria IN ('Básico', 'Completo', 'Premium')),
  
  fipe_min DECIMAL(12,2) NOT NULL,
  fipe_max DECIMAL(12,2) NOT NULL,
  
  valor_mensal DECIMAL(10,2) NOT NULL,
  
  regiao VARCHAR(50) DEFAULT 'default',
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tabelas_preco_mensalidade_tipo ON public.tabelas_preco_mensalidade(tipo_uso, categoria);
CREATE INDEX IF NOT EXISTS idx_tabelas_preco_mensalidade_fipe ON public.tabelas_preco_mensalidade(fipe_min, fipe_max);

-- ════════════════════════════════════════════════════════════════════
-- 5. TABELA: tabelas_preco_adesao (Taxas de Adesão)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tabelas_preco_adesao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  tipo_uso VARCHAR(20) NOT NULL CHECK (tipo_uso IN ('particular', 'aplicativo')),
  categoria VARCHAR(20) NOT NULL CHECK (categoria IN ('Básico', 'Completo', 'Premium')),
  
  fipe_min DECIMAL(12,2) NOT NULL,
  fipe_max DECIMAL(12,2) NOT NULL,
  
  valor_adesao DECIMAL(10,2) NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tabelas_preco_adesao_tipo ON public.tabelas_preco_adesao(tipo_uso, categoria);

-- ════════════════════════════════════════════════════════════════════
-- 6. POPULAR TABELAS DE PREÇO
-- ════════════════════════════════════════════════════════════════════

-- MENSALIDADE - PARTICULAR - BÁSICO
INSERT INTO public.tabelas_preco_mensalidade (tipo_uso, categoria, fipe_min, fipe_max, valor_mensal) VALUES
('particular', 'Básico', 0, 30000, 99.90),
('particular', 'Básico', 30000.01, 50000, 129.90),
('particular', 'Básico', 50000.01, 70000, 159.90),
('particular', 'Básico', 70000.01, 100000, 199.90),
('particular', 'Básico', 100000.01, 150000, 259.90),
('particular', 'Básico', 150000.01, 200000, 329.90),
('particular', 'Básico', 200000.01, 300000, 399.90),
('particular', 'Básico', 300000.01, 999999999, 499.90);

-- MENSALIDADE - PARTICULAR - COMPLETO (+35%)
INSERT INTO public.tabelas_preco_mensalidade (tipo_uso, categoria, fipe_min, fipe_max, valor_mensal) VALUES
('particular', 'Completo', 0, 30000, 134.87),
('particular', 'Completo', 30000.01, 50000, 175.37),
('particular', 'Completo', 50000.01, 70000, 215.87),
('particular', 'Completo', 70000.01, 100000, 269.87),
('particular', 'Completo', 100000.01, 150000, 350.87),
('particular', 'Completo', 150000.01, 200000, 445.37),
('particular', 'Completo', 200000.01, 300000, 539.87),
('particular', 'Completo', 300000.01, 999999999, 674.87);

-- MENSALIDADE - PARTICULAR - PREMIUM (+70%)
INSERT INTO public.tabelas_preco_mensalidade (tipo_uso, categoria, fipe_min, fipe_max, valor_mensal) VALUES
('particular', 'Premium', 0, 30000, 169.83),
('particular', 'Premium', 30000.01, 50000, 220.83),
('particular', 'Premium', 50000.01, 70000, 271.83),
('particular', 'Premium', 70000.01, 100000, 339.83),
('particular', 'Premium', 100000.01, 150000, 441.83),
('particular', 'Premium', 150000.01, 200000, 560.83),
('particular', 'Premium', 200000.01, 300000, 679.83),
('particular', 'Premium', 300000.01, 999999999, 849.83);

-- MENSALIDADE - APLICATIVO - BÁSICO (+45%)
INSERT INTO public.tabelas_preco_mensalidade (tipo_uso, categoria, fipe_min, fipe_max, valor_mensal) VALUES
('aplicativo', 'Básico', 0, 30000, 144.86),
('aplicativo', 'Básico', 30000.01, 50000, 188.36),
('aplicativo', 'Básico', 50000.01, 70000, 231.86),
('aplicativo', 'Básico', 70000.01, 100000, 289.86),
('aplicativo', 'Básico', 100000.01, 150000, 376.86),
('aplicativo', 'Básico', 150000.01, 200000, 478.36),
('aplicativo', 'Básico', 200000.01, 300000, 579.86),
('aplicativo', 'Básico', 300000.01, 999999999, 724.86);

-- MENSALIDADE - APLICATIVO - COMPLETO
INSERT INTO public.tabelas_preco_mensalidade (tipo_uso, categoria, fipe_min, fipe_max, valor_mensal) VALUES
('aplicativo', 'Completo', 0, 30000, 195.56),
('aplicativo', 'Completo', 30000.01, 50000, 254.29),
('aplicativo', 'Completo', 50000.01, 70000, 313.01),
('aplicativo', 'Completo', 70000.01, 100000, 391.31),
('aplicativo', 'Completo', 100000.01, 150000, 508.76),
('aplicativo', 'Completo', 150000.01, 200000, 645.79),
('aplicativo', 'Completo', 200000.01, 300000, 782.82),
('aplicativo', 'Completo', 300000.01, 999999999, 978.56);

-- MENSALIDADE - APLICATIVO - PREMIUM
INSERT INTO public.tabelas_preco_mensalidade (tipo_uso, categoria, fipe_min, fipe_max, valor_mensal) VALUES
('aplicativo', 'Premium', 0, 30000, 246.25),
('aplicativo', 'Premium', 30000.01, 50000, 320.20),
('aplicativo', 'Premium', 50000.01, 70000, 394.15),
('aplicativo', 'Premium', 70000.01, 100000, 492.76),
('aplicativo', 'Premium', 100000.01, 150000, 640.65),
('aplicativo', 'Premium', 150000.01, 200000, 813.20),
('aplicativo', 'Premium', 200000.01, 300000, 985.76),
('aplicativo', 'Premium', 300000.01, 999999999, 1232.26);

-- ADESÃO - PARTICULAR
INSERT INTO public.tabelas_preco_adesao (tipo_uso, categoria, fipe_min, fipe_max, valor_adesao) VALUES
('particular', 'Básico', 0, 100000, 199.90),
('particular', 'Básico', 100000.01, 999999999, 299.90),
('particular', 'Completo', 0, 100000, 249.90),
('particular', 'Completo', 100000.01, 999999999, 349.90),
('particular', 'Premium', 0, 100000, 299.90),
('particular', 'Premium', 100000.01, 999999999, 399.90);

-- ADESÃO - APLICATIVO
INSERT INTO public.tabelas_preco_adesao (tipo_uso, categoria, fipe_min, fipe_max, valor_adesao) VALUES
('aplicativo', 'Básico', 0, 100000, 249.90),
('aplicativo', 'Básico', 100000.01, 999999999, 349.90),
('aplicativo', 'Completo', 0, 100000, 299.90),
('aplicativo', 'Completo', 100000.01, 999999999, 399.90),
('aplicativo', 'Premium', 0, 100000, 349.90),
('aplicativo', 'Premium', 100000.01, 999999999, 449.90);

-- ════════════════════════════════════════════════════════════════════
-- 7. RLS POLICIES
-- ════════════════════════════════════════════════════════════════════

-- Habilitar RLS
ALTER TABLE public.cotacoes_publicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_publicas_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_publicas_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabelas_preco_mensalidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabelas_preco_adesao ENABLE ROW LEVEL SECURITY;

-- cotacoes_publicas - Leitura pública (cliente acessa via token)
CREATE POLICY "cotacoes_publicas_select_public" ON public.cotacoes_publicas
  FOR SELECT USING (true);

-- cotacoes_publicas - Update público (cliente atualiza sua jornada)
CREATE POLICY "cotacoes_publicas_update_public" ON public.cotacoes_publicas
  FOR UPDATE USING (true);

-- cotacoes_publicas - Insert apenas autenticado (vendedor cria)
CREATE POLICY "cotacoes_publicas_insert_auth" ON public.cotacoes_publicas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- cotacoes_publicas - Delete apenas autenticado
CREATE POLICY "cotacoes_publicas_delete_auth" ON public.cotacoes_publicas
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- cotacoes_publicas_fotos - Acesso público total (cliente envia fotos)
CREATE POLICY "cotacoes_publicas_fotos_all" ON public.cotacoes_publicas_fotos
  FOR ALL USING (true);

-- cotacoes_publicas_historico - Leitura pública, insert público
CREATE POLICY "cotacoes_publicas_historico_select" ON public.cotacoes_publicas_historico
  FOR SELECT USING (true);

CREATE POLICY "cotacoes_publicas_historico_insert" ON public.cotacoes_publicas_historico
  FOR INSERT WITH CHECK (true);

-- Tabelas de preço - Leitura pública
CREATE POLICY "tabelas_preco_mensalidade_select" ON public.tabelas_preco_mensalidade
  FOR SELECT USING (true);

CREATE POLICY "tabelas_preco_adesao_select" ON public.tabelas_preco_adesao
  FOR SELECT USING (true);

-- Tabelas de preço - Modificação apenas autenticado
CREATE POLICY "tabelas_preco_mensalidade_modify" ON public.tabelas_preco_mensalidade
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "tabelas_preco_adesao_modify" ON public.tabelas_preco_adesao
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ════════════════════════════════════════════════════════════════════
-- 8. TRIGGER PARA UPDATED_AT
-- ════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trigger_cotacoes_publicas_updated_at ON public.cotacoes_publicas;
CREATE TRIGGER trigger_cotacoes_publicas_updated_at
  BEFORE UPDATE ON public.cotacoes_publicas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();