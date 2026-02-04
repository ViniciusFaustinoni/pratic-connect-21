-- ==============================================
-- Fase 1: Adicionar campos de documentos pessoais na tabela cotacoes
-- ==============================================

-- Campos extraídos da CNH
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_rg VARCHAR(20);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_rg_orgao VARCHAR(20);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_cnh VARCHAR(20);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_cnh_validade DATE;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_cnh_categoria VARCHAR(10);

-- Campo de ano de fabricação do veículo (extraído do CRLV)
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_ano_fabricacao INTEGER;

-- ==============================================
-- Fase 2: Adicionar campos de snapshot completo na tabela contratos
-- ==============================================

-- Campos de documentos pessoais
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_rg VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_rg_orgao VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_cnh VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_cnh_validade DATE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_cnh_categoria VARCHAR(10);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_data_nascimento DATE;

-- Campos de endereço detalhado (atualmente tudo vai em cliente_endereco)
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_logradouro TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_numero VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_bairro VARCHAR(100);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_complemento VARCHAR(100);

-- Campos adicionais do veículo
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_combustivel VARCHAR(50);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_ano_fabricacao INTEGER;

-- Adicionar comentários para documentação
COMMENT ON COLUMN cotacoes.cliente_rg IS 'Número do RG extraído via OCR da CNH';
COMMENT ON COLUMN cotacoes.cliente_rg_orgao IS 'Órgão emissor do RG (SSP, DETRAN, etc)';
COMMENT ON COLUMN cotacoes.cliente_cnh IS 'Número de registro da CNH';
COMMENT ON COLUMN cotacoes.cliente_cnh_validade IS 'Data de validade da CNH';
COMMENT ON COLUMN cotacoes.cliente_cnh_categoria IS 'Categoria da CNH (A, B, AB, etc)';
COMMENT ON COLUMN cotacoes.veiculo_ano_fabricacao IS 'Ano de fabricação extraído do CRLV';

COMMENT ON COLUMN contratos.cliente_rg IS 'Snapshot do RG no momento da assinatura';
COMMENT ON COLUMN contratos.cliente_cnh IS 'Snapshot da CNH no momento da assinatura';
COMMENT ON COLUMN contratos.cliente_logradouro IS 'Logradouro detalhado (rua, avenida)';
COMMENT ON COLUMN contratos.cliente_numero IS 'Número do endereço';
COMMENT ON COLUMN contratos.cliente_bairro IS 'Bairro do endereço';
COMMENT ON COLUMN contratos.cliente_complemento IS 'Complemento do endereço';
COMMENT ON COLUMN contratos.veiculo_combustivel IS 'Tipo de combustível extraído do CRLV';
COMMENT ON COLUMN contratos.veiculo_ano_fabricacao IS 'Ano de fabricação extraído do CRLV';