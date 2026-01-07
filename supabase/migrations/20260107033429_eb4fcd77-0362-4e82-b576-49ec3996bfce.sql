-- =============================================
-- INFRAESTRUTURA MULTI-PLATAFORMA DE RASTREAMENTO
-- =============================================

-- 1. Atualizar constraint de plataforma na tabela rastreadores
ALTER TABLE rastreadores 
DROP CONSTRAINT IF EXISTS rastreadores_plataforma_check;

ALTER TABLE rastreadores 
ADD CONSTRAINT rastreadores_plataforma_check 
CHECK (plataforma IN ('rede_veiculos', 'softruck'));

-- 2. Adicionar campos novos na tabela rastreadores
ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS 
  plataforma_device_id VARCHAR(100);

ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS 
  bloqueado BOOLEAN DEFAULT FALSE;

ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS 
  dados_extras JSONB DEFAULT '{}';

ALTER TABLE rastreadores ADD COLUMN IF NOT EXISTS 
  config_plataforma JSONB DEFAULT '{}';

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_rastreadores_plataforma 
  ON rastreadores(plataforma);
  
CREATE INDEX IF NOT EXISTS idx_rastreadores_plataforma_device 
  ON rastreadores(plataforma_device_id);
  
CREATE INDEX IF NOT EXISTS idx_rastreadores_ultimo_sinal 
  ON rastreadores(ultima_comunicacao DESC);

-- =============================================
-- TABELA: rastreadores_config_plataformas
-- =============================================

CREATE TABLE IF NOT EXISTS rastreadores_config_plataformas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma VARCHAR(50) NOT NULL UNIQUE 
    CHECK (plataforma IN ('rede_veiculos', 'softruck')),
  nome_exibicao VARCHAR(100) NOT NULL,
  
  -- URLs de API
  api_url_sandbox TEXT NOT NULL,
  api_url_producao TEXT NOT NULL,
  
  -- Tipo de autenticação
  auth_type VARCHAR(20) NOT NULL 
    CHECK (auth_type IN ('bearer_fixo', 'oauth_jwt')),
  
  -- Funcionalidades suportadas
  suporta_posicao_tempo_real BOOLEAN DEFAULT FALSE,
  suporta_historico_trajeto BOOLEAN DEFAULT FALSE,
  suporta_acionamento_roubo BOOLEAN DEFAULT FALSE,
  suporta_bloqueio BOOLEAN DEFAULT FALSE,
  suporta_webhooks BOOLEAN DEFAULT FALSE,
  
  -- Controle
  ativa BOOLEAN DEFAULT TRUE,
  ambiente_atual VARCHAR(20) DEFAULT 'sandbox' 
    CHECK (ambiente_atual IN ('sandbox', 'producao')),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para config plataformas
ALTER TABLE rastreadores_config_plataformas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ler config plataformas" 
  ON rastreadores_config_plataformas
  FOR SELECT USING (am_i_funcionario());

CREATE POLICY "Gerencia pode gerenciar config plataformas" 
  ON rastreadores_config_plataformas
  FOR ALL USING (am_i_gerencia());

-- Dados iniciais das plataformas
INSERT INTO rastreadores_config_plataformas (
  plataforma, nome_exibicao, 
  api_url_sandbox, api_url_producao, 
  auth_type,
  suporta_posicao_tempo_real, suporta_historico_trajeto, 
  suporta_acionamento_roubo, suporta_bloqueio, suporta_webhooks
) VALUES 
(
  'rede_veiculos', 'Rede Veículos',
  'https://integracao.redeveiculos.com/api/v2/sandbox',
  'https://integracao.redeveiculos.com/api/v2/prod',
  'bearer_fixo',
  FALSE, FALSE, TRUE, FALSE, FALSE
),
(
  'softruck', 'Softruck',
  'https://api.apiary.softruck.com/v2',
  'https://api.softruck.com/v2',
  'oauth_jwt',
  TRUE, TRUE, FALSE, FALSE, TRUE
)
ON CONFLICT (plataforma) DO NOTHING;

-- =============================================
-- TABELA: rastreadores_tokens_cache
-- =============================================

CREATE TABLE IF NOT EXISTS rastreadores_tokens_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma VARCHAR(50) NOT NULL,
  token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (somente service role acessa via edge functions)
ALTER TABLE rastreadores_tokens_cache ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_tokens_plataforma 
  ON rastreadores_tokens_cache(plataforma);
  
CREATE INDEX IF NOT EXISTS idx_tokens_expires 
  ON rastreadores_tokens_cache(expires_at);

-- =============================================
-- TABELA: rastreadores_logs
-- =============================================

CREATE TABLE IF NOT EXISTS rastreadores_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rastreador_id UUID REFERENCES rastreadores(id) ON DELETE SET NULL,
  plataforma VARCHAR(50) NOT NULL,
  operacao VARCHAR(100) NOT NULL,
  request JSONB,
  response JSONB,
  status VARCHAR(20) CHECK (status IN ('sucesso', 'erro', 'timeout')),
  tempo_resposta_ms INTEGER,
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para logs
ALTER TABLE rastreadores_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ver logs rastreadores" 
  ON rastreadores_logs
  FOR SELECT USING (am_i_funcionario());

-- Índices
CREATE INDEX IF NOT EXISTS idx_logs_rastreador 
  ON rastreadores_logs(rastreador_id);
  
CREATE INDEX IF NOT EXISTS idx_logs_created 
  ON rastreadores_logs(created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_logs_plataforma 
  ON rastreadores_logs(plataforma);