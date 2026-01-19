-- =====================================================
-- CORRIGIR FLUXO DE VISTORIAS NO MAPA
-- =====================================================

-- 1. Atualizar view para incluir TODAS as vistorias pendentes
-- Inclui tanto 'agendada' quanto 'autovistoria' com instalação agendada
DROP VIEW IF EXISTS view_vistorias_mapa;

CREATE VIEW view_vistorias_mapa AS
-- Vistorias da tabela vistorias (existente)
SELECT 
  'vistoria'::text AS tipo_servico,
  v.id,
  v.tipo::text AS tipo_vistoria,
  v.status::text AS status,
  v.data_agendada,
  v.endereco_logradouro,
  v.endereco_numero,
  v.endereco_bairro,
  v.endereco_cidade,
  v.endereco_cep,
  v.endereco_latitude AS latitude,
  v.endereco_longitude AS longitude,
  a.id AS associado_id,
  a.nome AS associado_nome,
  a.telefone AS associado_telefone,
  ve.id AS veiculo_id,
  ve.placa,
  ve.marca,
  ve.modelo,
  f.id AS vistoriador_id,
  f.nome_completo AS vistoriador_nome
FROM vistorias v
LEFT JOIN associados a ON v.associado_id = a.id
LEFT JOIN veiculos ve ON v.veiculo_id = ve.id
LEFT JOIN funcionarios f ON v.vistoriador_id = f.id
WHERE v.status = 'agendada'::status_vistoria

UNION ALL

-- Cotações com agendamento DIRETO (cliente escolheu agendar)
SELECT 
  'vistoria_cotacao'::text AS tipo_servico,
  c.id,
  'entrada'::text AS tipo_vistoria,
  'agendada'::text AS status,
  c.vistoria_data_agendada AS data_agendada,
  c.vistoria_endereco_logradouro AS endereco_logradouro,
  c.vistoria_endereco_numero AS endereco_numero,
  c.vistoria_endereco_bairro AS endereco_bairro,
  c.vistoria_endereco_cidade AS endereco_cidade,
  c.vistoria_endereco_cep AS endereco_cep,
  c.vistoria_endereco_latitude AS latitude,
  c.vistoria_endereco_longitude AS longitude,
  NULL::uuid AS associado_id,
  c.nome_solicitante AS associado_nome,
  c.telefone1_solicitante AS associado_telefone,
  NULL::uuid AS veiculo_id,
  c.veiculo_placa AS placa,
  c.veiculo_marca AS marca,
  c.veiculo_modelo AS modelo,
  NULL::uuid AS vistoriador_id,
  NULL::text AS vistoriador_nome
FROM cotacoes c
WHERE c.tipo_vistoria::text = 'agendada'
  AND c.vistoria_concluida_em IS NULL
  AND c.vistoria_data_agendada IS NOT NULL

UNION ALL

-- NOVO: Cotações com AUTOVISTORIA que agendaram vistoria completa (instalação)
SELECT 
  'vistoria_cotacao_instalacao'::text AS tipo_servico,
  c.id,
  'instalacao'::text AS tipo_vistoria,
  'agendada'::text AS status,
  c.vistoria_completa_data_agendada AS data_agendada,
  COALESCE(c.vistoria_completa_endereco_logradouro, c.vistoria_endereco_logradouro) AS endereco_logradouro,
  COALESCE(c.vistoria_completa_endereco_numero, c.vistoria_endereco_numero) AS endereco_numero,
  COALESCE(c.vistoria_completa_endereco_bairro, c.vistoria_endereco_bairro) AS endereco_bairro,
  COALESCE(c.vistoria_completa_endereco_cidade, c.vistoria_endereco_cidade) AS endereco_cidade,
  COALESCE(c.vistoria_completa_endereco_cep, c.vistoria_endereco_cep) AS endereco_cep,
  c.vistoria_endereco_latitude AS latitude,
  c.vistoria_endereco_longitude AS longitude,
  NULL::uuid AS associado_id,
  c.nome_solicitante AS associado_nome,
  c.telefone1_solicitante AS associado_telefone,
  NULL::uuid AS veiculo_id,
  c.veiculo_placa AS placa,
  c.veiculo_marca AS marca,
  c.veiculo_modelo AS modelo,
  NULL::uuid AS vistoriador_id,
  NULL::text AS vistoriador_nome
FROM cotacoes c
WHERE c.tipo_vistoria::text = 'autovistoria'
  AND c.vistoria_completa_data_agendada IS NOT NULL
  AND c.vistoria_concluida_em IS NULL;

-- 2. Reverter cotações que foram marcadas como concluídas prematuramente
-- Essas cotações voltarão a aparecer no mapa
UPDATE cotacoes 
SET vistoria_concluida_em = NULL
WHERE vistoria_concluida_em IS NOT NULL
  AND (
    -- Autovistoria com agendamento de instalação pendente
    (tipo_vistoria = 'autovistoria' AND vistoria_completa_data_agendada IS NOT NULL)
    OR
    -- Agendada com data de agendamento mas sem instalação realizada
    (tipo_vistoria = 'agendada' AND vistoria_data_agendada IS NOT NULL)
  )
  -- Só reverter se não existe instalação concluída vinculada
  AND NOT EXISTS (
    SELECT 1 FROM instalacoes i 
    WHERE i.cotacao_id = cotacoes.id 
    AND i.status = 'concluida'
  );