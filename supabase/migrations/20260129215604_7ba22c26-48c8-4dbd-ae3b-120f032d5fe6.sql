-- =============================================
-- INTEGRAÇÃO SGA HINOVA - Campos e Tabelas
-- =============================================

-- Fase 1: Novos campos na tabela associados
ALTER TABLE associados 
ADD COLUMN IF NOT EXISTS codigo_hinova INTEGER,
ADD COLUMN IF NOT EXISTS sincronizado_hinova BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sincronizado_hinova_em TIMESTAMPTZ;

-- Fase 2: Novos campos na tabela veiculos
ALTER TABLE veiculos 
ADD COLUMN IF NOT EXISTS codigo_hinova INTEGER,
ADD COLUMN IF NOT EXISTS sincronizado_hinova BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sincronizado_hinova_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status_sga VARCHAR(50) DEFAULT 'pendente';

-- Comentário para documentação
COMMENT ON COLUMN veiculos.status_sga IS 'Status da sincronização: pendente | sincronizando | ativado_sga | erro_sincronizacao';

-- Fase 3: Tabela de logs de sincronização
CREATE TABLE IF NOT EXISTS sga_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  veiculo_id UUID REFERENCES veiculos(id) ON DELETE SET NULL,
  associado_id UUID REFERENCES associados(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  usuario_id UUID,
  duracao_ms INTEGER
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sga_sync_logs_veiculo ON sga_sync_logs(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_sga_sync_logs_associado ON sga_sync_logs(associado_id);
CREATE INDEX IF NOT EXISTS idx_sga_sync_logs_created ON sga_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sga_sync_logs_status ON sga_sync_logs(status);

-- RLS para logs
ALTER TABLE sga_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ver logs SGA" ON sga_sync_logs
FOR SELECT TO authenticated
USING (public.am_i_funcionario());

CREATE POLICY "Sistema pode inserir logs SGA" ON sga_sync_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- Fase 4: Tabela de mapeamentos de códigos Hinova
CREATE TABLE IF NOT EXISTS hinova_mapeamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,
  codigo_local VARCHAR(100) NOT NULL,
  codigo_hinova INTEGER NOT NULL,
  descricao VARCHAR(255),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tipo, codigo_local)
);

-- RLS para mapeamentos
ALTER TABLE hinova_mapeamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ler mapeamentos Hinova" ON hinova_mapeamentos
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Diretores podem gerenciar mapeamentos Hinova" ON hinova_mapeamentos
FOR ALL TO authenticated
USING (public.is_diretor(auth.uid()))
WITH CHECK (public.is_diretor(auth.uid()));

-- Fase 5: Inserir dados iniciais de mapeamento
INSERT INTO hinova_mapeamentos (tipo, codigo_local, codigo_hinova, descricao) VALUES
-- Cores
('cor', 'preto', 1, 'PRETO'),
('cor', 'branco', 2, 'BRANCO'),
('cor', 'prata', 3, 'PRATA'),
('cor', 'cinza', 4, 'CINZA'),
('cor', 'vermelho', 5, 'VERMELHO'),
('cor', 'azul', 6, 'AZUL'),
('cor', 'verde', 7, 'VERDE'),
('cor', 'amarelo', 8, 'AMARELO'),
('cor', 'marrom', 9, 'MARROM'),
('cor', 'bege', 10, 'BEGE'),
('cor', 'laranja', 11, 'LARANJA'),
('cor', 'dourado', 12, 'DOURADO'),
('cor', 'rosa', 13, 'ROSA'),
('cor', 'roxo', 14, 'ROXO'),
('cor', 'bronze', 15, 'BRONZE'),
-- Combustível
('combustivel', 'gasolina', 1, 'GASOLINA'),
('combustivel', 'etanol', 2, 'ETANOL'),
('combustivel', 'alcool', 2, 'ETANOL'),
('combustivel', 'flex', 3, 'FLEX'),
('combustivel', 'diesel', 4, 'DIESEL'),
('combustivel', 'gnv', 5, 'GNV'),
('combustivel', 'eletrico', 6, 'ELETRICO'),
('combustivel', 'hibrido', 7, 'HIBRIDO'),
-- Tipo de veículo
('tipo_veiculo', 'automovel', 1, 'AUTOMOVEL'),
('tipo_veiculo', 'carro', 1, 'AUTOMOVEL'),
('tipo_veiculo', 'motocicleta', 2, 'MOTOCICLETA'),
('tipo_veiculo', 'moto', 2, 'MOTOCICLETA'),
('tipo_veiculo', 'caminhao', 3, 'CAMINHAO'),
('tipo_veiculo', 'utilitario', 4, 'UTILITARIO'),
('tipo_veiculo', 'van', 4, 'UTILITARIO'),
('tipo_veiculo', 'pickup', 4, 'UTILITARIO'),
-- Tipos de foto/documento
('tipo_foto', 'cnh', 1, 'CNH'),
('tipo_foto', 'crlv', 2, 'CRLV'),
('tipo_foto', 'comprovante_residencia', 3, 'COMPROVANTE RESIDENCIA'),
('tipo_foto', 'foto_frontal_veiculo', 4, 'FOTO FRENTE'),
('tipo_foto', 'foto_frente', 4, 'FOTO FRENTE'),
('tipo_foto', 'foto_traseira_veiculo', 5, 'FOTO TRASEIRA'),
('tipo_foto', 'foto_traseira', 5, 'FOTO TRASEIRA'),
('tipo_foto', 'foto_lateral_esquerda', 6, 'FOTO LATERAL ESQUERDA'),
('tipo_foto', 'foto_lateral_direita', 7, 'FOTO LATERAL DIREITA'),
('tipo_foto', 'foto_motor', 8, 'FOTO MOTOR'),
('tipo_foto', 'foto_chassi', 9, 'FOTO CHASSI'),
('tipo_foto', 'foto_painel', 10, 'FOTO PAINEL'),
('tipo_foto', 'foto_hodometro', 10, 'FOTO KM'),
('tipo_foto', 'foto_km', 10, 'FOTO KM'),
('tipo_foto', 'rg', 11, 'RG'),
('tipo_foto', 'cpf', 12, 'CPF')
ON CONFLICT (tipo, codigo_local) DO NOTHING;