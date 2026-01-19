-- Criar view de vistorias pendentes com coordenadas para o mapa
CREATE OR REPLACE VIEW view_vistorias_mapa AS
-- Vistorias da tabela vistorias
SELECT 
  'vistoria'::text as tipo_servico,
  v.id,
  v.tipo::text as tipo_vistoria,
  v.status::text as status,
  v.data_agendada,
  v.endereco_logradouro,
  v.endereco_numero,
  v.endereco_bairro,
  v.endereco_cidade,
  v.endereco_cep,
  v.endereco_latitude as latitude,
  v.endereco_longitude as longitude,
  a.id as associado_id,
  a.nome as associado_nome,
  a.telefone as associado_telefone,
  ve.id as veiculo_id,
  ve.placa,
  ve.marca,
  ve.modelo,
  f.id as vistoriador_id,
  f.nome_completo as vistoriador_nome
FROM vistorias v
LEFT JOIN associados a ON v.associado_id = a.id
LEFT JOIN veiculos ve ON v.veiculo_id = ve.id
LEFT JOIN funcionarios f ON v.vistoriador_id = f.id
WHERE v.status = 'agendada'

UNION ALL

-- Vistorias de cotações agendadas
SELECT 
  'vistoria_cotacao'::text as tipo_servico,
  c.id,
  'entrada'::text as tipo_vistoria,
  'agendada'::text as status,
  c.vistoria_data_agendada as data_agendada,
  c.vistoria_endereco_logradouro as endereco_logradouro,
  c.vistoria_endereco_numero as endereco_numero,
  c.vistoria_endereco_bairro as endereco_bairro,
  c.vistoria_endereco_cidade as endereco_cidade,
  c.vistoria_endereco_cep as endereco_cep,
  c.vistoria_endereco_latitude as latitude,
  c.vistoria_endereco_longitude as longitude,
  NULL::uuid as associado_id,
  c.nome_solicitante as associado_nome,
  c.telefone1_solicitante as associado_telefone,
  NULL::uuid as veiculo_id,
  c.veiculo_placa as placa,
  c.veiculo_marca as marca,
  c.veiculo_modelo as modelo,
  NULL::uuid as vistoriador_id,
  NULL::text as vistoriador_nome
FROM cotacoes c
WHERE c.tipo_vistoria = 'agendada'
  AND c.vistoria_concluida_em IS NULL
  AND c.vistoria_data_agendada IS NOT NULL;