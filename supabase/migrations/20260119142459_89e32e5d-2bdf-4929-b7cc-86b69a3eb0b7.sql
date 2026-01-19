-- Atualizar a view para incluir dados de rota e vistoriador
DROP VIEW IF EXISTS view_vistorias_mapa;

CREATE VIEW view_vistorias_mapa AS
-- Vistorias da tabela vistorias
SELECT 
  'vistoria'::text as tipo_servico, 
  v.id, 
  v.tipo::text as tipo_vistoria, 
  v.status::text as status, 
  v.data_agendada,
  a.logradouro as endereco_logradouro, 
  a.numero as endereco_numero, 
  a.bairro as endereco_bairro,
  a.cidade as endereco_cidade, 
  a.cep as endereco_cep, 
  a.endereco_latitude as latitude, 
  a.endereco_longitude as longitude,
  a.nome as associado_nome, 
  a.telefone as associado_telefone, 
  a.whatsapp as associado_whatsapp,
  ve.marca as veiculo_marca, 
  ve.modelo as veiculo_modelo, 
  ve.placa as veiculo_placa, 
  ve.cor as veiculo_cor,
  v.vistoriador_id, 
  v.horario_agendado::text as horario_agendado,
  v.rota_id,
  r.codigo as rota_codigo,
  r.regiao as rota_regiao,
  p.nome as vistoriador_nome
FROM vistorias v 
JOIN associados a ON v.associado_id = a.id 
LEFT JOIN veiculos ve ON v.veiculo_id = ve.id 
LEFT JOIN rotas r ON v.rota_id = r.id
LEFT JOIN profiles p ON v.vistoriador_id = p.id
WHERE v.status = 'agendada'

UNION ALL

-- Cotações com vistoria agendada
SELECT 
  'vistoria_cotacao'::text, 
  c.id, 
  'entrada'::text, 
  'agendada'::text, 
  c.vistoria_data_agendada,
  c.vistoria_endereco_logradouro, 
  c.vistoria_endereco_numero, 
  c.vistoria_endereco_bairro, 
  c.vistoria_endereco_cidade,
  c.vistoria_endereco_cep, 
  c.vistoria_endereco_latitude, 
  c.vistoria_endereco_longitude,
  c.nome_solicitante, 
  c.telefone1_solicitante, 
  c.telefone2_solicitante,
  c.veiculo_marca, 
  c.veiculo_modelo, 
  c.veiculo_placa, 
  NULL::text,
  NULL::uuid,
  c.vistoria_horario_agendado,
  c.vistoria_rota_id,
  r.codigo as rota_codigo,
  r.regiao as rota_regiao,
  NULL::text as vistoriador_nome
FROM cotacoes c 
LEFT JOIN rotas r ON c.vistoria_rota_id = r.id
WHERE c.tipo_vistoria = 'agendada' AND c.vistoria_concluida_em IS NULL AND c.vistoria_data_agendada IS NOT NULL

UNION ALL

-- Cotações autovistoria (instalação pendente)
SELECT 
  'vistoria_cotacao_autovistoria'::text, 
  c.id, 
  'instalacao'::text, 
  'agendada'::text, 
  c.vistoria_completa_data_agendada,
  COALESCE(c.vistoria_completa_endereco_logradouro, c.vistoria_endereco_logradouro),
  COALESCE(c.vistoria_completa_endereco_numero, c.vistoria_endereco_numero),
  COALESCE(c.vistoria_completa_endereco_bairro, c.vistoria_endereco_bairro),
  COALESCE(c.vistoria_completa_endereco_cidade, c.vistoria_endereco_cidade),
  COALESCE(c.vistoria_completa_endereco_cep, c.vistoria_endereco_cep),
  c.vistoria_endereco_latitude, 
  c.vistoria_endereco_longitude,
  c.nome_solicitante, 
  c.telefone1_solicitante, 
  c.telefone2_solicitante,
  c.veiculo_marca, 
  c.veiculo_modelo, 
  c.veiculo_placa, 
  NULL::text,
  NULL::uuid,
  c.vistoria_completa_horario_agendado,
  c.vistoria_rota_id,
  r.codigo as rota_codigo,
  r.regiao as rota_regiao,
  NULL::text as vistoriador_nome
FROM cotacoes c 
LEFT JOIN rotas r ON c.vistoria_rota_id = r.id
WHERE c.tipo_vistoria = 'autovistoria' AND c.vistoria_completa_data_agendada IS NOT NULL AND c.vistoria_concluida_em IS NULL

UNION ALL

-- Contratos autovistoria (instalação pendente)
SELECT 
  'vistoria_contrato_autovistoria'::text, 
  ct.id, 
  'instalacao'::text, 
  'agendada'::text, 
  ct.vistoria_completa_data_agendada,
  ct.vistoria_completa_endereco_logradouro, 
  ct.vistoria_completa_endereco_numero, 
  ct.vistoria_completa_endereco_bairro,
  ct.vistoria_completa_endereco_cidade, 
  ct.vistoria_completa_endereco_cep, 
  ct.vistoria_endereco_latitude, 
  ct.vistoria_endereco_longitude,
  a.nome, 
  a.telefone, 
  a.whatsapp, 
  ct.veiculo_marca, 
  ct.veiculo_modelo, 
  ct.veiculo_placa, 
  NULL::text,
  NULL::uuid,
  ct.vistoria_completa_horario_agendado,
  NULL::uuid as rota_id,
  NULL::text as rota_codigo,
  NULL::text as rota_regiao,
  NULL::text as vistoriador_nome
FROM contratos ct 
LEFT JOIN associados a ON ct.associado_id = a.id
WHERE ct.tipo_vistoria = 'autovistoria' AND ct.vistoria_completa_data_agendada IS NOT NULL AND ct.vistoria_concluida_em IS NULL;