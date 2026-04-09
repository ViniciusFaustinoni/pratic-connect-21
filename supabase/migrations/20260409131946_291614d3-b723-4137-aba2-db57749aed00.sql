
-- Step 1: Backfill vistorias (only those with data_agendada)
INSERT INTO servicos (tipo, status, data_agendada, hora_agendada, logradouro, numero, bairro, cidade, cep, latitude, longitude, associado_id, veiculo_id, vistoria_origem_id, observacoes)
SELECT
  CASE v.tipo::text
    WHEN 'entrada' THEN 'vistoria_entrada'::tipo_servico
    WHEN 'saida' THEN 'vistoria_saida'::tipo_servico
    ELSE COALESCE(v.tipo::text, 'vistoria_entrada')::tipo_servico
  END,
  CASE v.status
    WHEN 'pendente' THEN 'pendente'::status_servico
    WHEN 'agendada' THEN 'agendada'::status_servico
    WHEN 'em_rota' THEN 'em_rota'::status_servico
    WHEN 'em_andamento' THEN 'em_andamento'::status_servico
    ELSE 'pendente'::status_servico
  END,
  v.data_agendada,
  v.horario_agendado,
  v.endereco_logradouro,
  v.endereco_numero,
  v.endereco_bairro,
  v.endereco_cidade,
  v.endereco_cep,
  v.endereco_latitude,
  v.endereco_longitude,
  v.associado_id,
  v.veiculo_id,
  v.id,
  'Backfill automático a partir de vistoria'
FROM vistorias v
WHERE v.status IN ('pendente', 'agendada', 'em_rota', 'em_andamento')
  AND v.data_agendada IS NOT NULL
  AND (v.associado_id IS NOT NULL OR v.lead_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM servicos s WHERE s.vistoria_origem_id = v.id);

-- Step 2: Backfill instalacoes (only those with data_agendada)
INSERT INTO servicos (tipo, status, data_agendada, hora_agendada, logradouro, numero, bairro, cidade, cep, latitude, longitude, associado_id, veiculo_id, instalacao_origem_id, observacoes)
SELECT
  'instalacao'::tipo_servico,
  CASE i.status
    WHEN 'agendada' THEN 'agendada'::status_servico
    WHEN 'em_rota' THEN 'em_rota'::status_servico
    WHEN 'em_andamento' THEN 'em_andamento'::status_servico
    WHEN 'reagendada' THEN 'agendada'::status_servico
    ELSE 'pendente'::status_servico
  END,
  i.data_agendada,
  i.hora_agendada,
  i.logradouro,
  i.numero,
  i.bairro,
  i.cidade,
  i.cep,
  i.endereco_latitude,
  i.endereco_longitude,
  i.associado_id,
  i.veiculo_id,
  i.id,
  'Backfill automático a partir de instalação'
FROM instalacoes i
WHERE i.status IN ('agendada', 'em_rota', 'em_andamento', 'reagendada')
  AND i.data_agendada IS NOT NULL
  AND i.associado_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM servicos s WHERE s.instalacao_origem_id = i.id);

-- Step 3: Recreate the view with servico_id_unificado
CREATE OR REPLACE VIEW public.view_vistorias_mapa AS
-- VISTORIAS
SELECT v.id,
    v.tipo::text AS tipo_vistoria,
    COALESCE(v.origem, 'vistoria'::text) AS tipo_servico,
    COALESCE(sv.status::text, v.status::text) AS status,
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
    COALESCE(sv.profissional_id, v.vistoriador_id, (SELECT ri.instalador_id FROM rota_instaladores ri WHERE ri.rota_id = v.rota_id LIMIT 1)) AS vistoriador_id,
    COALESCE(sv.rota_id, v.rota_id) AS rota_id,
    COALESCE(rsv.codigo, r.codigo) AS rota_codigo,
    COALESCE(rsv.regiao, r.regiao) AS rota_regiao,
    COALESCE(rsv.cor, r.cor) AS rota_cor,
    COALESCE(psv.nome, pv.nome, (SELECT p.nome FROM rota_instaladores ri JOIN profiles p ON p.id = ri.instalador_id WHERE ri.rota_id = v.rota_id LIMIT 1)) AS vistoriador_nome,
    COALESCE(sv.confirmacao_whatsapp::text, NULL::text) AS confirmacao_whatsapp,
    COALESCE(sv.permite_encaixe, false) AS permite_encaixe,
    COALESCE(sv.periodo::text, NULL::text) AS periodo,
    'vistorias'::text AS origem_registro,
    sv.id AS servico_id_unificado
FROM vistorias v
    LEFT JOIN associados a ON a.id = v.associado_id
    LEFT JOIN leads l ON l.id = v.lead_id
    LEFT JOIN veiculos ve ON ve.id = v.veiculo_id
    LEFT JOIN cotacoes cot ON cot.id = v.cotacao_id
    LEFT JOIN contratos ctr ON ctr.id = v.contrato_id
    LEFT JOIN rotas r ON r.id = v.rota_id
    LEFT JOIN profiles pv ON pv.id = v.vistoriador_id
    LEFT JOIN servicos sv ON sv.vistoria_origem_id = v.id
    LEFT JOIN rotas rsv ON rsv.id = sv.rota_id
    LEFT JOIN profiles psv ON psv.id = sv.profissional_id
WHERE v.status = ANY (ARRAY['pendente'::status_vistoria, 'agendada'::status_vistoria, 'em_rota'::status_vistoria, 'em_andamento'::status_vistoria])
    AND (v.associado_id IS NOT NULL OR v.lead_id IS NOT NULL)
    AND (v.data_agendada IS NULL OR v.data_agendada >= (CURRENT_DATE - '30 days'::interval))

UNION ALL

-- INSTALACOES
SELECT i.id,
    'instalacao'::text AS tipo_vistoria,
    'instalacao'::text AS tipo_servico,
    COALESCE(si.status::text, i.status::text) AS status,
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
    COALESCE(si.profissional_id, i.instalador_responsavel_id, (SELECT ri.instalador_id FROM rota_instaladores ri WHERE ri.rota_id = i.rota_id LIMIT 1)) AS vistoriador_id,
    COALESCE(si.rota_id, i.rota_id) AS rota_id,
    COALESCE(rsi.codigo, r.codigo) AS rota_codigo,
    COALESCE(rsi.regiao, r.regiao) AS rota_regiao,
    COALESCE(rsi.cor, r.cor) AS rota_cor,
    COALESCE(psi.nome, pi.nome, (SELECT p.nome FROM rota_instaladores ri JOIN profiles p ON p.id = ri.instalador_id WHERE ri.rota_id = i.rota_id LIMIT 1)) AS vistoriador_nome,
    COALESCE(si.confirmacao_whatsapp::text, NULL::text) AS confirmacao_whatsapp,
    COALESCE(si.permite_encaixe, false) AS permite_encaixe,
    COALESCE(si.periodo::text, NULL::text) AS periodo,
    'instalacoes'::text AS origem_registro,
    si.id AS servico_id_unificado
FROM instalacoes i
    LEFT JOIN associados a ON a.id = i.associado_id
    LEFT JOIN veiculos ve ON ve.id = i.veiculo_id
    LEFT JOIN rotas r ON r.id = i.rota_id
    LEFT JOIN profiles pi ON pi.id = i.instalador_responsavel_id
    LEFT JOIN servicos si ON si.instalacao_origem_id = i.id
    LEFT JOIN rotas rsi ON rsi.id = si.rota_id
    LEFT JOIN profiles psi ON psi.id = si.profissional_id
WHERE i.status = ANY (ARRAY['agendada'::status_instalacao, 'em_rota'::status_instalacao, 'em_andamento'::status_instalacao, 'reagendada'::status_instalacao])
    AND i.associado_id IS NOT NULL
    AND (i.data_agendada IS NULL OR i.data_agendada >= (CURRENT_DATE - '30 days'::interval))

UNION ALL

-- SERVICOS (standalone only)
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
    COALESCE(a.nome, s.observacoes) AS associado_nome,
    a.telefone AS associado_telefone,
    a.whatsapp AS associado_whatsapp,
    COALESCE(ve.marca, '(sem veículo)'::text) AS veiculo_marca,
    COALESCE(ve.modelo, ''::text) AS veiculo_modelo,
    COALESCE(ve.placa, 'Pendente'::text) AS veiculo_placa,
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
    'servicos'::text AS origem_registro,
    s.id AS servico_id_unificado
FROM servicos s
    LEFT JOIN associados a ON a.id = s.associado_id
    LEFT JOIN veiculos ve ON ve.id = s.veiculo_id
    LEFT JOIN rotas r ON r.id = s.rota_id
    LEFT JOIN profiles p ON p.id = s.profissional_id
WHERE s.status = ANY (ARRAY['pendente'::status_servico, 'agendada'::status_servico, 'em_rota'::status_servico, 'em_andamento'::status_servico])
    AND s.vistoria_origem_id IS NULL
    AND s.instalacao_origem_id IS NULL
    AND s.associado_id IS NOT NULL
    AND (s.data_agendada IS NULL OR s.data_agendada >= (CURRENT_DATE - '30 days'::interval));
