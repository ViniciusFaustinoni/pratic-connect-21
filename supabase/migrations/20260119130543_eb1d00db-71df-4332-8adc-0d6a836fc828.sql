-- Adicionar coluna vistoria_rota_id em cotacoes
ALTER TABLE cotacoes
ADD COLUMN IF NOT EXISTS vistoria_rota_id UUID REFERENCES rotas(id) ON DELETE SET NULL;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_cotacoes_vistoria_rota_id ON cotacoes(vistoria_rota_id);

-- Criar view unificada de serviços pendentes para rotas
CREATE OR REPLACE VIEW servicos_pendentes_rota AS
-- Instalações pendentes
SELECT 
  'instalacao'::text as tipo_servico,
  i.id,
  i.bairro as endereco_bairro,
  i.cidade as endereco_cidade,
  i.cep as endereco_cep,
  i.logradouro as endereco_logradouro,
  i.numero as endereco_numero,
  i.data_agendada,
  i.periodo,
  i.rota_id,
  a.id as associado_id,
  a.nome as associado_nome,
  a.telefone as associado_telefone,
  v.id as veiculo_id,
  v.placa,
  v.marca,
  v.modelo,
  NULL::tipo_vistoria as tipo_vistoria
FROM instalacoes i
JOIN associados a ON i.associado_id = a.id
LEFT JOIN veiculos v ON i.veiculo_id = v.id
WHERE i.status IN ('agendada', 'reagendada')

UNION ALL

-- Vistorias pendentes (tabela vistorias)
SELECT 
  'vistoria'::text as tipo_servico,
  vis.id,
  vis.endereco_bairro,
  vis.endereco_cidade,
  vis.endereco_cep,
  vis.endereco_logradouro,
  vis.endereco_numero,
  vis.data_agendada::date,
  NULL as periodo,
  vis.rota_id,
  a.id as associado_id,
  a.nome as associado_nome,
  a.telefone as associado_telefone,
  v.id as veiculo_id,
  v.placa,
  v.marca,
  v.modelo,
  vis.tipo as tipo_vistoria
FROM vistorias vis
JOIN associados a ON vis.associado_id = a.id
LEFT JOIN veiculos v ON vis.veiculo_id = v.id
WHERE vis.status = 'agendada'

UNION ALL

-- Vistorias de cotações (agendadas durante contratação)
SELECT 
  'vistoria_cotacao'::text as tipo_servico,
  c.id,
  c.vistoria_endereco_bairro as endereco_bairro,
  c.vistoria_endereco_cidade as endereco_cidade,
  c.vistoria_endereco_cep as endereco_cep,
  c.vistoria_endereco_logradouro as endereco_logradouro,
  c.vistoria_endereco_numero as endereco_numero,
  c.vistoria_data_agendada::date as data_agendada,
  NULL as periodo,
  c.vistoria_rota_id as rota_id,
  NULL::uuid as associado_id,
  c.nome_solicitante as associado_nome,
  c.telefone1_solicitante as associado_telefone,
  NULL::uuid as veiculo_id,
  c.veiculo_placa as placa,
  c.veiculo_marca as marca,
  c.veiculo_modelo as modelo,
  'entrada'::tipo_vistoria as tipo_vistoria
FROM cotacoes c
WHERE c.tipo_vistoria = 'agendada'
AND c.vistoria_concluida_em IS NULL
AND c.vistoria_data_agendada IS NOT NULL;