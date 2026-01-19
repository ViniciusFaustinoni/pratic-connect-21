-- Corrigir view_vistorias_mapa para incluir status 'agendada'
DROP VIEW IF EXISTS view_vistorias_mapa;

CREATE VIEW view_vistorias_mapa AS
SELECT 
  v.id,
  v.tipo::text AS tipo_vistoria,
  COALESCE(v.origem, 'vistoria') AS tipo_servico,
  v.status::text AS status,
  v.data_agendada,
  v.horario_agendado::text AS horario_agendado,
  v.endereco_logradouro,
  v.endereco_numero,
  v.endereco_bairro,
  v.endereco_cidade,
  v.endereco_cep,
  v.endereco_latitude AS latitude,
  v.endereco_longitude AS longitude,
  COALESCE(a.nome, l.nome) AS associado_nome,
  COALESCE(a.telefone, l.telefone) AS associado_telefone,
  a.whatsapp AS associado_whatsapp,
  COALESCE(ve.marca, cot.veiculo_marca::text, ctr.veiculo_marca::text) AS veiculo_marca,
  COALESCE(ve.modelo, cot.veiculo_modelo::text, ctr.veiculo_modelo::text) AS veiculo_modelo,
  COALESCE(ve.placa, cot.veiculo_placa::text, ctr.veiculo_placa::text) AS veiculo_placa,
  COALESCE(ve.cor, ctr.veiculo_cor::text) AS veiculo_cor,
  v.vistoriador_id,
  v.rota_id,
  r.codigo AS rota_codigo,
  r.regiao AS rota_regiao,
  r.cor AS rota_cor,
  COALESCE(pv.nome, (
    SELECT p.nome FROM rota_instaladores ri
    JOIN profiles p ON p.user_id = ri.instalador_id
    WHERE ri.rota_id = v.rota_id LIMIT 1
  )) AS vistoriador_nome
FROM vistorias v
LEFT JOIN associados a ON a.id = v.associado_id
LEFT JOIN leads l ON l.id = v.lead_id
LEFT JOIN veiculos ve ON ve.id = v.veiculo_id
LEFT JOIN cotacoes cot ON cot.id = v.cotacao_id
LEFT JOIN contratos ctr ON ctr.id = v.contrato_id
LEFT JOIN rotas r ON r.id = v.rota_id
LEFT JOIN profiles pv ON pv.user_id = v.vistoriador_id
WHERE v.status IN ('pendente', 'em_analise', 'agendada');