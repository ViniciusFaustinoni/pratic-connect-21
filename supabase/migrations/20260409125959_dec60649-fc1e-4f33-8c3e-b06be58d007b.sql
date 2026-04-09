CREATE OR REPLACE VIEW public.view_vistorias_mapa AS
-- VISTORIAS
SELECT v.id,
    v.tipo::text AS tipo_vistoria,
    COALESCE(v.origem, 'vistoria'::text) AS tipo_servico,
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
    COALESCE(v.vistoriador_id, (SELECT ri.instalador_id FROM rota_instaladores ri WHERE ri.rota_id = v.rota_id LIMIT 1)) AS vistoriador_id,
    v.rota_id,
    r.codigo AS rota_codigo,
    r.regiao AS rota_regiao,
    r.cor AS rota_cor,
    COALESCE(pv.nome, (SELECT p.nome FROM rota_instaladores ri JOIN profiles p ON p.id = ri.instalador_id WHERE ri.rota_id = v.rota_id LIMIT 1)) AS vistoriador_nome,
    NULL::text AS confirmacao_whatsapp,
    false AS permite_encaixe,
    NULL::text AS periodo,
    'vistorias'::text AS origem_registro
FROM vistorias v
    LEFT JOIN associados a ON a.id = v.associado_id
    LEFT JOIN leads l ON l.id = v.lead_id
    LEFT JOIN veiculos ve ON ve.id = v.veiculo_id
    LEFT JOIN cotacoes cot ON cot.id = v.cotacao_id
    LEFT JOIN contratos ctr ON ctr.id = v.contrato_id
    LEFT JOIN rotas r ON r.id = v.rota_id
    LEFT JOIN profiles pv ON pv.id = v.vistoriador_id
WHERE v.status = ANY (ARRAY['pendente'::status_vistoria, 'agendada'::status_vistoria, 'em_rota'::status_vistoria, 'em_andamento'::status_vistoria])
    AND (v.associado_id IS NOT NULL OR v.lead_id IS NOT NULL)
    AND (v.data_agendada IS NULL OR v.data_agendada >= (CURRENT_DATE - '30 days'::interval))

UNION ALL

-- INSTALACOES
SELECT i.id,
    'instalacao'::text AS tipo_vistoria,
    'instalacao'::text AS tipo_servico,
    i.status::text AS status,
    i.data_agendada,
    i.hora_agendada::text AS horario_agendado,
    i.logradouro AS endereco_logradouro,
    i.numero AS endereco_numero,
    i.bairro AS endereco_bairro,
    i.cidade AS endereco_cidade,
    i.cep AS endereco_cep,
    i.endereco_latitude AS latitude,
    i.endereco_longitude AS longitude,
    a.nome AS associado_nome,
    a.telefone AS associado_telefone,
    a.whatsapp AS associado_whatsapp,
    ve.marca AS veiculo_marca,
    ve.modelo AS veiculo_modelo,
    ve.placa AS veiculo_placa,
    ve.cor AS veiculo_cor,
    COALESCE(i.instalador_responsavel_id, (SELECT ri.instalador_id FROM rota_instaladores ri WHERE ri.rota_id = i.rota_id LIMIT 1)) AS vistoriador_id,
    i.rota_id,
    r.codigo AS rota_codigo,
    r.regiao AS rota_regiao,
    r.cor AS rota_cor,
    COALESCE(pi.nome, (SELECT p.nome FROM rota_instaladores ri JOIN profiles p ON p.id = ri.instalador_id WHERE ri.rota_id = i.rota_id LIMIT 1)) AS vistoriador_nome,
    NULL::text AS confirmacao_whatsapp,
    false AS permite_encaixe,
    NULL::text AS periodo,
    'instalacoes'::text AS origem_registro
FROM instalacoes i
    LEFT JOIN associados a ON a.id = i.associado_id
    LEFT JOIN veiculos ve ON ve.id = i.veiculo_id
    LEFT JOIN rotas r ON r.id = i.rota_id
    LEFT JOIN profiles pi ON pi.id = i.instalador_responsavel_id
WHERE i.status = ANY (ARRAY['agendada'::status_instalacao, 'em_rota'::status_instalacao, 'em_andamento'::status_instalacao, 'reagendada'::status_instalacao])
    AND i.associado_id IS NOT NULL
    AND (i.data_agendada IS NULL OR i.data_agendada >= (CURRENT_DATE - '30 days'::interval))

UNION ALL

-- SERVICOS
SELECT s.id,
    s.tipo::text AS tipo_vistoria,
    s.tipo::text AS tipo_servico,
    s.status::text AS status,
    s.data_agendada,
    s.hora_agendada::text AS horario_agendado,
    s.logradouro AS endereco_logradouro,
    s.numero AS endereco_numero,
    s.bairro AS endereco_bairro,
    s.cidade AS endereco_cidade,
    s.cep AS endereco_cep,
    s.latitude,
    s.longitude,
    COALESCE(a.nome, (SELECT aa.nome FROM associados aa JOIN instalacoes io ON io.associado_id = aa.id WHERE io.id = s.instalacao_origem_id LIMIT 1), s.observacoes) AS associado_nome,
    COALESCE(a.telefone, (SELECT aa.telefone FROM associados aa JOIN instalacoes io ON io.associado_id = aa.id WHERE io.id = s.instalacao_origem_id LIMIT 1)) AS associado_telefone,
    a.whatsapp AS associado_whatsapp,
    COALESCE(ve.marca, (SELECT vv.marca FROM veiculos vv JOIN instalacoes io ON io.veiculo_id = vv.id WHERE io.id = s.instalacao_origem_id LIMIT 1), '(sem veículo)'::text) AS veiculo_marca,
    COALESCE(ve.modelo, (SELECT vv.modelo FROM veiculos vv JOIN instalacoes io ON io.veiculo_id = vv.id WHERE io.id = s.instalacao_origem_id LIMIT 1), ''::text) AS veiculo_modelo,
    COALESCE(ve.placa, (SELECT vv.placa FROM veiculos vv JOIN instalacoes io ON io.veiculo_id = vv.id WHERE io.id = s.instalacao_origem_id LIMIT 1), 'Pendente'::text) AS veiculo_placa,
    ve.cor AS veiculo_cor,
    s.profissional_id AS vistoriador_id,
    s.rota_id,
    r.codigo AS rota_codigo,
    r.regiao AS rota_regiao,
    r.cor AS rota_cor,
    p.nome AS vistoriador_nome,
    s.confirmacao_whatsapp::text AS confirmacao_whatsapp,
    COALESCE(s.permite_encaixe, false) AS permite_encaixe,
    s.periodo::text AS periodo,
    'servicos'::text AS origem_registro
FROM servicos s
    LEFT JOIN associados a ON a.id = s.associado_id
    LEFT JOIN veiculos ve ON ve.id = s.veiculo_id
    LEFT JOIN rotas r ON r.id = s.rota_id
    LEFT JOIN profiles p ON p.id = s.profissional_id
WHERE s.status = ANY (ARRAY['pendente'::status_servico, 'agendada'::status_servico, 'em_rota'::status_servico, 'em_andamento'::status_servico])
    AND (s.instalacao_origem_id IS NULL OR NOT EXISTS (SELECT 1 FROM instalacoes i WHERE i.id = s.instalacao_origem_id AND i.status = ANY (ARRAY['agendada'::status_instalacao, 'em_rota'::status_instalacao, 'em_andamento'::status_instalacao, 'reagendada'::status_instalacao])))
    AND (s.vistoria_origem_id IS NULL OR NOT EXISTS (SELECT 1 FROM vistorias v WHERE v.id = s.vistoria_origem_id AND v.status = ANY (ARRAY['pendente'::status_vistoria, 'agendada'::status_vistoria, 'em_rota'::status_vistoria, 'em_andamento'::status_vistoria])))
    AND (s.associado_id IS NOT NULL OR s.instalacao_origem_id IS NOT NULL)
    AND (s.data_agendada IS NULL OR s.data_agendada >= (CURRENT_DATE - '30 days'::interval));