-- Cotacoes: campos adicionais do cliente
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_estado_civil VARCHAR(30);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_profissao VARCHAR(100);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS cliente_telefone_secundario VARCHAR(20);

-- Cotacoes: campos adicionais do veiculo
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_categoria VARCHAR(50);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_tipo_uso VARCHAR(50);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_alienado BOOLEAN DEFAULT FALSE;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_financeira VARCHAR(100);
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS veiculo_procedencia VARCHAR(50);

-- Contratos: snapshot completo
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_estado_civil VARCHAR(30);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_profissao VARCHAR(100);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cliente_telefone_secundario VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_categoria VARCHAR(50);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_tipo_uso VARCHAR(50);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_alienado BOOLEAN DEFAULT FALSE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_financeira VARCHAR(100);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS veiculo_procedencia VARCHAR(50);

-- Configuracoes: dados completos da ABP (tipo = 'texto' conforme CHECK constraint)
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES 
  ('empresa_razao_social', 'Associação de Benefícios PraticCar', 'texto', 'empresa', 'Razão social completa', true),
  ('empresa_logradouro', 'Av. das Américas', 'texto', 'empresa', 'Logradouro da empresa', true),
  ('empresa_numero', '19.005', 'texto', 'empresa', 'Número do endereço', true),
  ('empresa_bairro', 'Recreio dos Bandeirantes', 'texto', 'empresa', 'Bairro', true),
  ('empresa_cidade', 'Rio de Janeiro', 'texto', 'empresa', 'Cidade', true),
  ('empresa_uf', 'RJ', 'texto', 'empresa', 'Estado', true),
  ('empresa_cep', '22790-703', 'texto', 'empresa', 'CEP', true),
  ('empresa_lgpd_email', 'lgpd@praticcar.com.br', 'texto', 'empresa', 'E-mail para LGPD', true)
ON CONFLICT (chave) DO NOTHING;