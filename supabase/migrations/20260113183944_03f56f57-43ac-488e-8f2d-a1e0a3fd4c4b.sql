-- Adicionar colunas para link do associado e controle de adesão na tabela contratos
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS link_token uuid DEFAULT gen_random_uuid();
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS link_gerado_em timestamp with time zone;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS tipo_vistoria varchar(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS adesao_paga boolean DEFAULT false;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS adesao_paga_em timestamp with time zone;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS adesao_cobranca_id uuid;

-- Adicionar colunas para vistoria na tabela vistorias
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES contratos(id);
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS modalidade varchar(20) DEFAULT 'presencial';
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS horario_agendado time;

-- Criar índice único para o token de link (para busca rápida)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contratos_link_token ON contratos(link_token) WHERE link_token IS NOT NULL;

-- Criar índice para buscar vistorias por contrato
CREATE INDEX IF NOT EXISTS idx_vistorias_contrato_id ON vistorias(contrato_id) WHERE contrato_id IS NOT NULL;

-- Comentários nas colunas
COMMENT ON COLUMN contratos.link_token IS 'Token único para acesso do associado ao link de vistoria';
COMMENT ON COLUMN contratos.link_gerado_em IS 'Data/hora em que o link foi gerado';
COMMENT ON COLUMN contratos.tipo_vistoria IS 'Tipo de vistoria escolhida: agendada ou autovistoria';
COMMENT ON COLUMN contratos.adesao_paga IS 'Indica se a taxa de adesão foi paga';
COMMENT ON COLUMN contratos.adesao_paga_em IS 'Data/hora em que a adesão foi paga';
COMMENT ON COLUMN vistorias.contrato_id IS 'Contrato associado à vistoria';
COMMENT ON COLUMN vistorias.modalidade IS 'Modalidade da vistoria: presencial ou autovistoria';
COMMENT ON COLUMN vistorias.horario_agendado IS 'Horário específico agendado para vistoria presencial';