-- =============================================
-- CORREÇÃO 1: Atualizar RLS da tabela instalacoes
-- =============================================

-- Remover políticas antigas de SELECT
DROP POLICY IF EXISTS "Staff and own installers can view instalacoes" ON public.instalacoes;
DROP POLICY IF EXISTS "Staff can manage instalacoes" ON public.instalacoes;

-- Criar política de SELECT que considera rota_instaladores
CREATE POLICY "Staff and own installers can view instalacoes"
ON public.instalacoes FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento'::app_role) OR
  has_role(auth.uid(), 'diretor'::app_role) OR
  has_role(auth.uid(), 'admin_master'::app_role) OR
  has_role(auth.uid(), 'desenvolvedor'::app_role) OR
  has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  (has_role(auth.uid(), 'instalador_vistoriador'::app_role) AND (
    instalador_id = get_my_profile_id() 
    OR EXISTS (
      SELECT 1 FROM rota_instaladores ri 
      WHERE ri.rota_id = instalacoes.rota_id 
      AND ri.instalador_id = get_my_profile_id()
    )
  ))
);

-- Política de ALL (INSERT/UPDATE/DELETE) para staff e instaladores atribuídos
CREATE POLICY "Staff can manage instalacoes"
ON public.instalacoes FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento'::app_role) OR
  has_role(auth.uid(), 'diretor'::app_role) OR
  has_role(auth.uid(), 'admin_master'::app_role) OR
  has_role(auth.uid(), 'desenvolvedor'::app_role) OR
  has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  (has_role(auth.uid(), 'instalador_vistoriador'::app_role) AND (
    instalador_id = get_my_profile_id() 
    OR EXISTS (
      SELECT 1 FROM rota_instaladores ri 
      WHERE ri.rota_id = instalacoes.rota_id 
      AND ri.instalador_id = get_my_profile_id()
    )
  ))
)
WITH CHECK (
  has_role(auth.uid(), 'coordenador_monitoramento'::app_role) OR
  has_role(auth.uid(), 'diretor'::app_role) OR
  has_role(auth.uid(), 'admin_master'::app_role) OR
  has_role(auth.uid(), 'desenvolvedor'::app_role) OR
  has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  (has_role(auth.uid(), 'instalador_vistoriador'::app_role) AND (
    instalador_id = get_my_profile_id() 
    OR EXISTS (
      SELECT 1 FROM rota_instaladores ri 
      WHERE ri.rota_id = instalacoes.rota_id 
      AND ri.instalador_id = get_my_profile_id()
    )
  ))
);

-- =============================================
-- CORREÇÃO 2: Atualizar view_vistorias_mapa
-- =============================================

DROP VIEW IF EXISTS view_vistorias_mapa;

CREATE VIEW view_vistorias_mapa AS
-- Parte 1: VISTORIAS
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
  -- vistoriador_id considera rota_instaladores
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
WHERE v.status IN ('pendente', 'em_analise', 'agendada')

UNION ALL

-- Parte 2: INSTALAÇÕES
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
  -- vistoriador_id considera rota_instaladores
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
WHERE i.status IN ('agendada', 'em_rota', 'em_andamento', 'reagendada');