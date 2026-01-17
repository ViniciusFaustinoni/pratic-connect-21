-- Adicionar novos campos para fluxo de contratação via link da cotação
ALTER TABLE cotacoes 
  -- Dados do cliente (preenchidos no link)
  ADD COLUMN IF NOT EXISTS cliente_cpf VARCHAR,
  ADD COLUMN IF NOT EXISTS cliente_data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS cliente_cep VARCHAR,
  ADD COLUMN IF NOT EXISTS cliente_logradouro TEXT,
  ADD COLUMN IF NOT EXISTS cliente_numero VARCHAR,
  ADD COLUMN IF NOT EXISTS cliente_complemento VARCHAR,
  ADD COLUMN IF NOT EXISTS cliente_bairro VARCHAR,
  ADD COLUMN IF NOT EXISTS cliente_cidade VARCHAR,
  ADD COLUMN IF NOT EXISTS cliente_uf VARCHAR(2),
  
  -- Documentos enviados
  ADD COLUMN IF NOT EXISTS doc_cnh_frente TEXT,
  ADD COLUMN IF NOT EXISTS doc_cnh_verso TEXT,
  ADD COLUMN IF NOT EXISTS doc_crlv TEXT,
  ADD COLUMN IF NOT EXISTS doc_comprovante TEXT,
  ADD COLUMN IF NOT EXISTS doc_selfie TEXT,
  
  -- Controle do fluxo de contratação
  ADD COLUMN IF NOT EXISTS plano_escolhido_id UUID REFERENCES planos(id),
  ADD COLUMN IF NOT EXISTS status_contratacao VARCHAR DEFAULT 'aguardando',
  
  -- Vistoria
  ADD COLUMN IF NOT EXISTS tipo_vistoria VARCHAR,
  ADD COLUMN IF NOT EXISTS vistoria_concluida_em TIMESTAMPTZ,
  
  -- Controle de acesso
  ADD COLUMN IF NOT EXISTS visualizado_em TIMESTAMPTZ,
  
  -- Contrato gerado a partir da cotação
  ADD COLUMN IF NOT EXISTS contrato_gerado_id UUID REFERENCES contratos(id);

-- Adicionar comentários explicativos
COMMENT ON COLUMN cotacoes.status_contratacao IS 'Status do fluxo: aguardando, plano_escolhido, dados_preenchidos, documentos_ok, vistoria_ok, pagamento_ok, contrato_gerado';
COMMENT ON COLUMN cotacoes.tipo_vistoria IS 'Tipo de vistoria escolhida: autovistoria ou agendada';

-- Criar índice para buscas por status de contratação
CREATE INDEX IF NOT EXISTS idx_cotacoes_status_contratacao ON cotacoes(status_contratacao);