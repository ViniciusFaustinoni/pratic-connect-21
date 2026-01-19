-- Recriar view servicos_pendentes_rota

DROP VIEW IF EXISTS servicos_pendentes_rota;

CREATE VIEW servicos_pendentes_rota AS
-- Instalações pendentes
SELECT 
  i.id,
  'instalacao'::text as tipo_servico,
  NULL::text as tipo_vistoria,
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
  v.modelo
FROM instalacoes i
LEFT JOIN associados a ON a.id = i.associado_id
LEFT JOIN veiculos v ON v.id = i.veiculo_id
WHERE i.status IN ('agendada', 'reagendada')

UNION ALL

-- Vistorias pendentes (tabela unificada)
SELECT 
  vis.id,
  COALESCE(vis.origem, 'vistoria')::text as tipo_servico,
  vis.tipo::text as tipo_vistoria,
  vis.endereco_bairro,
  vis.endereco_cidade,
  vis.endereco_cep,
  vis.endereco_logradouro,
  vis.endereco_numero,
  vis.data_agendada,
  NULL as periodo,
  vis.rota_id,
  COALESCE(vis.associado_id, l.associado_id) as associado_id,
  COALESCE(a.nome, l.nome) as associado_nome,
  COALESCE(a.telefone, l.telefone) as associado_telefone,
  vis.veiculo_id,
  COALESCE(ve.placa, cot.veiculo_placa, ctr.veiculo_placa) as placa,
  COALESCE(ve.marca, cot.veiculo_marca, ctr.veiculo_marca) as marca,
  COALESCE(ve.modelo, cot.veiculo_modelo, ctr.veiculo_modelo) as modelo
FROM vistorias vis
LEFT JOIN associados a ON a.id = vis.associado_id
LEFT JOIN leads l ON l.id = vis.lead_id
LEFT JOIN veiculos ve ON ve.id = vis.veiculo_id
LEFT JOIN cotacoes cot ON cot.id = vis.cotacao_id
LEFT JOIN contratos ctr ON ctr.id = vis.contrato_id
WHERE vis.status IN ('pendente', 'em_analise');