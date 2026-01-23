-- Recriar view_vistorias_mapa incluindo tabela unificada servicos
DROP VIEW IF EXISTS view_vistorias_mapa;

CREATE VIEW view_vistorias_mapa AS
-- Parte 1: VISTORIAS (tabela legada)
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
  COALESCE(
    v.vistoriador_id,
    (SELECT ri.instalador_id FROM rota_instaladores ri WHERE ri.rota_id = v.rota_id LIMIT 1)
  ) AS vistoriador_id,
  v.rota_id,
  r.codigo AS rota_codigo,
  r.regiao AS rota_regiao,
  r.cor AS rota_cor,
  COALESCE(
    pv.nome, 
    (SELECT p.nome FROM rota_instaladores ri JOIN profiles p ON p.id = ri.instalador_id WHERE ri.rota_id = v.rota_id LIMIT 1)
  ) AS vistoriador_nome
FROM vistorias v
LEFT JOIN associados a ON a.id = v.associado_id
LEFT JOIN leads l ON l.id = v.lead_id
LEFT JOIN veiculos ve ON ve.id = v.veiculo_id
LEFT JOIN cotacoes cot ON cot.id = v.cotacao_id
LEFT JOIN contratos ctr ON ctr.id = v.contrato_id
LEFT JOIN rotas r ON r.id = v.rota_id
LEFT JOIN profiles pv ON pv.id = v.vistoriador_id
WHERE v.status IN ('pendente', 'em_analise', 'agendada', 'em_rota', 'em_andamento')

UNION ALL

-- Parte 2: INSTALAÇÕES (tabela legada)
SELECT 
  i.id,
  'instalacao' AS tipo_vistoria,
  'instalacao' AS tipo_servico,
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
  COALESCE(
    i.instalador_responsavel_id,
    (SELECT ri.instalador_id FROM rota_instaladores ri WHERE ri.rota_id = i.rota_id LIMIT 1)
  ) AS vistoriador_id,
  i.rota_id,
  r.codigo AS rota_codigo,
  r.regiao AS rota_regiao,
  r.cor AS rota_cor,
  COALESCE(
    pi.nome, 
    (SELECT p.nome FROM rota_instaladores ri JOIN profiles p ON p.id = ri.instalador_id WHERE ri.rota_id = i.rota_id LIMIT 1)
  ) AS vistoriador_nome
FROM instalacoes i
LEFT JOIN associados a ON a.id = i.associado_id
LEFT JOIN veiculos ve ON ve.id = i.veiculo_id
LEFT JOIN rotas r ON r.id = i.rota_id
LEFT JOIN profiles pi ON pi.id = i.instalador_responsavel_id
WHERE i.status IN ('agendada', 'em_rota', 'em_andamento', 'reagendada')

UNION ALL

-- Parte 3: SERVIÇOS (tabela unificada) - para capturar atribuições automáticas
SELECT 
  s.id,
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
  -- Buscar nome do associado: primeiro da tabela servicos, depois da instalacao de origem
  COALESCE(
    a.nome,
    (SELECT aa.nome FROM associados aa JOIN instalacoes io ON io.associado_id = aa.id WHERE io.id = s.instalacao_origem_id LIMIT 1),
    s.observacoes
  ) AS associado_nome,
  COALESCE(
    a.telefone,
    (SELECT aa.telefone FROM associados aa JOIN instalacoes io ON io.associado_id = aa.id WHERE io.id = s.instalacao_origem_id LIMIT 1)
  ) AS associado_telefone,
  a.whatsapp AS associado_whatsapp,
  -- Buscar dados do veículo: primeiro da tabela servicos, depois da instalacao de origem
  COALESCE(
    ve.marca,
    (SELECT vv.marca FROM veiculos vv JOIN instalacoes io ON io.veiculo_id = vv.id WHERE io.id = s.instalacao_origem_id LIMIT 1),
    '(sem veículo)'
  ) AS veiculo_marca,
  COALESCE(
    ve.modelo,
    (SELECT vv.modelo FROM veiculos vv JOIN instalacoes io ON io.veiculo_id = vv.id WHERE io.id = s.instalacao_origem_id LIMIT 1),
    ''
  ) AS veiculo_modelo,
  COALESCE(
    ve.placa,
    (SELECT vv.placa FROM veiculos vv JOIN instalacoes io ON io.veiculo_id = vv.id WHERE io.id = s.instalacao_origem_id LIMIT 1),
    'Pendente'
  ) AS veiculo_placa,
  ve.cor AS veiculo_cor,
  -- Profissional atribuído
  s.profissional_id AS vistoriador_id,
  s.rota_id,
  r.codigo AS rota_codigo,
  r.regiao AS rota_regiao,
  r.cor AS rota_cor,
  p.nome AS vistoriador_nome
FROM servicos s
LEFT JOIN associados a ON a.id = s.associado_id
LEFT JOIN veiculos ve ON ve.id = s.veiculo_id
LEFT JOIN rotas r ON r.id = s.rota_id
LEFT JOIN profiles p ON p.id = s.profissional_id
WHERE s.status IN ('pendente', 'agendada', 'em_rota', 'em_andamento')
  -- Evitar duplicatas: só inclui servicos que NÃO têm correspondente ativo nas tabelas legadas
  AND (
    s.instalacao_origem_id IS NULL 
    OR NOT EXISTS (
      SELECT 1 FROM instalacoes i 
      WHERE i.id = s.instalacao_origem_id 
        AND i.status IN ('agendada', 'em_rota', 'em_andamento', 'reagendada')
    )
  )
  AND (
    s.vistoria_origem_id IS NULL 
    OR NOT EXISTS (
      SELECT 1 FROM vistorias v 
      WHERE v.id = s.vistoria_origem_id 
        AND v.status IN ('pendente', 'em_analise', 'agendada', 'em_rota', 'em_andamento')
    )
  );