-- Recriar view_vistorias_mapa com vistoriador_nome derivado de rota_instaladores
DROP VIEW IF EXISTS view_vistorias_mapa;

CREATE VIEW view_vistorias_mapa AS
-- Vistorias da tabela vistorias
SELECT 'vistoria'::text AS tipo_servico,
    v.id,
    v.tipo::text AS tipo_vistoria,
    v.status::text AS status,
    v.data_agendada,
    a.logradouro AS endereco_logradouro,
    a.numero AS endereco_numero,
    a.bairro AS endereco_bairro,
    a.cidade AS endereco_cidade,
    a.cep AS endereco_cep,
    a.endereco_latitude AS latitude,
    a.endereco_longitude AS longitude,
    a.nome AS associado_nome,
    a.telefone AS associado_telefone,
    a.whatsapp AS associado_whatsapp,
    ve.marca AS veiculo_marca,
    ve.modelo AS veiculo_modelo,
    ve.placa AS veiculo_placa,
    ve.cor AS veiculo_cor,
    v.vistoriador_id,
    v.horario_agendado::text AS horario_agendado,
    v.rota_id,
    r.codigo AS rota_codigo,
    r.regiao AS rota_regiao,
    r.cor AS rota_cor,
    p.nome AS vistoriador_nome
FROM vistorias v
JOIN associados a ON v.associado_id = a.id
LEFT JOIN veiculos ve ON v.veiculo_id = ve.id
LEFT JOIN rotas r ON v.rota_id = r.id
LEFT JOIN profiles p ON v.vistoriador_id = p.id
WHERE v.status = 'agendada'::status_vistoria

UNION ALL

-- Vistorias de cotações (vistoria agendada)
SELECT 'vistoria_cotacao'::text AS tipo_servico,
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
    c.nome_solicitante AS associado_nome,
    c.telefone1_solicitante AS associado_telefone,
    c.telefone2_solicitante AS associado_whatsapp,
    c.veiculo_marca,
    c.veiculo_modelo,
    c.veiculo_placa,
    NULL::text AS veiculo_cor,
    ri.instalador_id AS vistoriador_id,
    c.vistoria_horario_agendado AS horario_agendado,
    c.vistoria_rota_id AS rota_id,
    r.codigo AS rota_codigo,
    r.regiao AS rota_regiao,
    r.cor AS rota_cor,
    COALESCE(p.nome, c.vistoria_responsavel_nome) AS vistoriador_nome
FROM cotacoes c
LEFT JOIN rotas r ON c.vistoria_rota_id = r.id
LEFT JOIN LATERAL (
    SELECT instalador_id FROM rota_instaladores 
    WHERE rota_id = c.vistoria_rota_id 
    ORDER BY created_at LIMIT 1
) ri ON true
LEFT JOIN profiles p ON ri.instalador_id = p.id
WHERE c.tipo_vistoria::text = 'agendada'::text 
  AND c.vistoria_concluida_em IS NULL 
  AND c.vistoria_data_agendada IS NOT NULL

UNION ALL

-- Vistorias de cotações (autovistoria - vistoria completa)
SELECT 'vistoria_cotacao_autovistoria'::text AS tipo_servico,
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
    c.nome_solicitante AS associado_nome,
    c.telefone1_solicitante AS associado_telefone,
    c.telefone2_solicitante AS associado_whatsapp,
    c.veiculo_marca,
    c.veiculo_modelo,
    c.veiculo_placa,
    NULL::text AS veiculo_cor,
    ri.instalador_id AS vistoriador_id,
    c.vistoria_completa_horario_agendado AS horario_agendado,
    c.vistoria_rota_id AS rota_id,
    r.codigo AS rota_codigo,
    r.regiao AS rota_regiao,
    r.cor AS rota_cor,
    COALESCE(p.nome, c.vistoria_responsavel_nome) AS vistoriador_nome
FROM cotacoes c
LEFT JOIN rotas r ON c.vistoria_rota_id = r.id
LEFT JOIN LATERAL (
    SELECT instalador_id FROM rota_instaladores 
    WHERE rota_id = c.vistoria_rota_id 
    ORDER BY created_at LIMIT 1
) ri ON true
LEFT JOIN profiles p ON ri.instalador_id = p.id
WHERE c.tipo_vistoria::text = 'autovistoria'::text 
  AND c.vistoria_completa_data_agendada IS NOT NULL 
  AND c.vistoria_concluida_em IS NULL

UNION ALL

-- Vistorias de contratos (autovistoria) - usando campos diretos do contrato
SELECT 'vistoria_contrato_autovistoria'::text AS tipo_servico,
    ct.id,
    'instalacao'::text AS tipo_vistoria,
    'agendada'::text AS status,
    ct.vistoria_completa_data_agendada AS data_agendada,
    ct.vistoria_completa_endereco_logradouro AS endereco_logradouro,
    ct.vistoria_completa_endereco_numero AS endereco_numero,
    ct.vistoria_completa_endereco_bairro AS endereco_bairro,
    ct.vistoria_completa_endereco_cidade AS endereco_cidade,
    ct.vistoria_completa_endereco_cep AS endereco_cep,
    ct.vistoria_endereco_latitude AS latitude,
    ct.vistoria_endereco_longitude AS longitude,
    a.nome AS associado_nome,
    a.telefone AS associado_telefone,
    a.whatsapp AS associado_whatsapp,
    ct.veiculo_marca AS veiculo_marca,
    ct.veiculo_modelo AS veiculo_modelo,
    ct.veiculo_placa AS veiculo_placa,
    ct.veiculo_cor AS veiculo_cor,
    ri.instalador_id AS vistoriador_id,
    ct.vistoria_completa_horario_agendado AS horario_agendado,
    ct.vistoria_rota_id AS rota_id,
    r.codigo AS rota_codigo,
    r.regiao AS rota_regiao,
    r.cor AS rota_cor,
    p.nome AS vistoriador_nome
FROM contratos ct
JOIN associados a ON ct.associado_id = a.id
LEFT JOIN rotas r ON ct.vistoria_rota_id = r.id
LEFT JOIN LATERAL (
    SELECT instalador_id FROM rota_instaladores 
    WHERE rota_id = ct.vistoria_rota_id 
    ORDER BY created_at LIMIT 1
) ri ON true
LEFT JOIN profiles p ON ri.instalador_id = p.id
WHERE ct.vistoria_completa_data_agendada IS NOT NULL 
  AND ct.vistoria_concluida_em IS NULL;