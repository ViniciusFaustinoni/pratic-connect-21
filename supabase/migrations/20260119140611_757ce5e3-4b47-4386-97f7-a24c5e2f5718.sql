-- Adicionar campos para agendamento da vistoria completa na tabela contratos
ALTER TABLE contratos
ADD COLUMN IF NOT EXISTS vistoria_completa_data_agendada DATE,
ADD COLUMN IF NOT EXISTS vistoria_completa_horario_agendado TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_cep TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_logradouro TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_numero TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_bairro TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_cidade TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_endereco_estado TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_responsavel_eu_mesmo BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS vistoria_completa_responsavel_nome TEXT,
ADD COLUMN IF NOT EXISTS vistoria_completa_responsavel_telefone TEXT,
ADD COLUMN IF NOT EXISTS vistoria_endereco_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS vistoria_endereco_longitude NUMERIC,
ADD COLUMN IF NOT EXISTS vistoria_concluida_em TIMESTAMPTZ;

-- Dropar e recriar a view
DROP VIEW IF EXISTS view_vistorias_mapa;

CREATE VIEW view_vistorias_mapa AS
SELECT 
  'vistoria'::text as tipo_servico, v.id, v.tipo::text as tipo_vistoria, v.status::text as status, v.data_agendada,
  a.logradouro as endereco_logradouro, a.numero as endereco_numero, a.bairro as endereco_bairro,
  a.cidade as endereco_cidade, a.cep as endereco_cep, a.endereco_latitude as latitude, a.endereco_longitude as longitude,
  a.nome as associado_nome, a.telefone as associado_telefone, a.whatsapp as associado_whatsapp,
  ve.marca as veiculo_marca, ve.modelo as veiculo_modelo, ve.placa as veiculo_placa, ve.cor as veiculo_cor,
  v.vistoriador_id, v.horario_agendado::text as horario_agendado
FROM vistorias v JOIN associados a ON v.associado_id = a.id LEFT JOIN veiculos ve ON v.veiculo_id = ve.id WHERE v.status = 'agendada'
UNION ALL
SELECT 'vistoria_cotacao'::text, c.id, 'entrada'::text, 'agendada'::text, c.vistoria_data_agendada,
  c.vistoria_endereco_logradouro, c.vistoria_endereco_numero, c.vistoria_endereco_bairro, c.vistoria_endereco_cidade,
  c.vistoria_endereco_cep, c.vistoria_endereco_latitude, c.vistoria_endereco_longitude,
  c.nome_solicitante, c.telefone1_solicitante, c.telefone2_solicitante,
  c.veiculo_marca, c.veiculo_modelo, c.veiculo_placa, NULL::text, NULL::uuid, c.vistoria_horario_agendado
FROM cotacoes c WHERE c.tipo_vistoria = 'agendada' AND c.vistoria_concluida_em IS NULL AND c.vistoria_data_agendada IS NOT NULL
UNION ALL
SELECT 'vistoria_cotacao_autovistoria'::text, c.id, 'instalacao'::text, 'agendada'::text, c.vistoria_completa_data_agendada,
  COALESCE(c.vistoria_completa_endereco_logradouro, c.vistoria_endereco_logradouro),
  COALESCE(c.vistoria_completa_endereco_numero, c.vistoria_endereco_numero),
  COALESCE(c.vistoria_completa_endereco_bairro, c.vistoria_endereco_bairro),
  COALESCE(c.vistoria_completa_endereco_cidade, c.vistoria_endereco_cidade),
  COALESCE(c.vistoria_completa_endereco_cep, c.vistoria_endereco_cep),
  c.vistoria_endereco_latitude, c.vistoria_endereco_longitude,
  c.nome_solicitante, c.telefone1_solicitante, c.telefone2_solicitante,
  c.veiculo_marca, c.veiculo_modelo, c.veiculo_placa, NULL::text, NULL::uuid, c.vistoria_completa_horario_agendado
FROM cotacoes c WHERE c.tipo_vistoria = 'autovistoria' AND c.vistoria_completa_data_agendada IS NOT NULL AND c.vistoria_concluida_em IS NULL
UNION ALL
SELECT 'vistoria_contrato_autovistoria'::text, ct.id, 'instalacao'::text, 'agendada'::text, ct.vistoria_completa_data_agendada,
  ct.vistoria_completa_endereco_logradouro, ct.vistoria_completa_endereco_numero, ct.vistoria_completa_endereco_bairro,
  ct.vistoria_completa_endereco_cidade, ct.vistoria_completa_endereco_cep, ct.vistoria_endereco_latitude, ct.vistoria_endereco_longitude,
  a.nome, a.telefone, a.whatsapp, ct.veiculo_marca, ct.veiculo_modelo, ct.veiculo_placa, NULL::text, NULL::uuid, ct.vistoria_completa_horario_agendado
FROM contratos ct LEFT JOIN associados a ON ct.associado_id = a.id
WHERE ct.tipo_vistoria = 'autovistoria' AND ct.vistoria_completa_data_agendada IS NOT NULL AND ct.vistoria_concluida_em IS NULL;