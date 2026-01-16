-- =============================================
-- TABELA: ASSINATURAS DE DOCUMENTOS
-- =============================================

CREATE TABLE documento_assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_gerado_id UUID NOT NULL REFERENCES documento_gerados(id),
  
  -- Dados do Autentique
  autentique_documento_id VARCHAR(100),
  autentique_url VARCHAR(500),
  autentique_url_download VARCHAR(500),
  
  -- Signatários
  signatarios JSONB DEFAULT '[]',
  
  -- Status
  status VARCHAR(30) DEFAULT 'pendente' CHECK (status IN (
    'pendente',
    'enviado',
    'aguardando',
    'parcial',
    'assinado',
    'recusado',
    'expirado',
    'cancelado'
  )),
  
  -- Datas
  enviado_em TIMESTAMPTZ,
  assinado_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ,
  
  -- Controle
  tentativas INTEGER DEFAULT 0,
  ultimo_erro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_assinaturas_documento ON documento_assinaturas(documento_gerado_id);
CREATE INDEX idx_assinaturas_status ON documento_assinaturas(status);
CREATE INDEX idx_assinaturas_autentique ON documento_assinaturas(autentique_documento_id);

-- RLS
ALTER TABLE documento_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assinaturas visíveis para autenticados" ON documento_assinaturas
  FOR ALL TO authenticated USING (true);

-- Atualizar tabela documento_gerados para incluir referência
ALTER TABLE documento_gerados 
ADD COLUMN IF NOT EXISTS assinatura_id UUID REFERENCES documento_assinaturas(id);