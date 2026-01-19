-- Estágio 2: Migração de Dados para Unificação de Vistorias (Corrigido)

-- 2.1 Migrar vistorias de cotacoes para tabela vistorias
INSERT INTO vistorias (
  associado_id, veiculo_id, tipo, origem, cotacao_id, lead_id,
  data_agendada, horario_agendado,
  endereco_logradouro, endereco_numero, endereco_bairro,
  endereco_cidade, endereco_estado, endereco_cep,
  endereco_latitude, endereco_longitude,
  rota_id, status, created_at
)
SELECT 
  l.associado_id,
  NULL,
  'saida'::tipo_vistoria,
  'cotacao',
  c.id,
  c.lead_id,
  c.vistoria_data_agendada,
  CASE 
    WHEN c.vistoria_horario_agendado IS NOT NULL AND c.vistoria_horario_agendado != '' 
    THEN c.vistoria_horario_agendado::time 
    ELSE NULL 
  END,
  c.vistoria_endereco_logradouro,
  c.vistoria_endereco_numero,
  c.vistoria_endereco_bairro,
  c.vistoria_endereco_cidade,
  c.vistoria_endereco_estado,
  c.vistoria_endereco_cep,
  c.vistoria_endereco_latitude,
  c.vistoria_endereco_longitude,
  c.vistoria_rota_id,
  CASE 
    WHEN c.vistoria_concluida_em IS NOT NULL THEN 'aprovada'::status_vistoria 
    ELSE 'pendente'::status_vistoria 
  END,
  c.created_at
FROM cotacoes c
LEFT JOIN leads l ON l.id = c.lead_id
WHERE c.vistoria_data_agendada IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM vistorias v WHERE v.cotacao_id = c.id);

-- 2.2 Atualizar referências vistoria_id em cotacoes
UPDATE cotacoes c 
SET vistoria_id = v.id
FROM vistorias v 
WHERE v.cotacao_id = c.id 
AND c.vistoria_id IS NULL;

-- 2.3 Migrar vistorias de contratos para tabela vistorias (sem veiculo_id - contratos não tem FK)
INSERT INTO vistorias (
  associado_id, tipo, origem, contrato_id,
  data_agendada, horario_agendado,
  endereco_logradouro, endereco_numero, endereco_bairro,
  endereco_cidade, endereco_estado, endereco_cep,
  rota_id, status, created_at
)
SELECT 
  ct.associado_id,
  'saida'::tipo_vistoria,
  'contrato',
  ct.id,
  ct.vistoria_completa_data_agendada,
  CASE 
    WHEN ct.vistoria_completa_horario_agendado IS NOT NULL AND ct.vistoria_completa_horario_agendado != '' 
    THEN ct.vistoria_completa_horario_agendado::time 
    ELSE NULL 
  END,
  ct.vistoria_completa_endereco_logradouro,
  ct.vistoria_completa_endereco_numero,
  ct.vistoria_completa_endereco_bairro,
  ct.vistoria_completa_endereco_cidade,
  ct.vistoria_completa_endereco_estado,
  ct.vistoria_completa_endereco_cep,
  ct.vistoria_rota_id,
  CASE 
    WHEN ct.vistoria_concluida_em IS NOT NULL THEN 'aprovada'::status_vistoria 
    ELSE 'pendente'::status_vistoria 
  END,
  ct.created_at
FROM contratos ct
WHERE ct.vistoria_completa_data_agendada IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM vistorias v WHERE v.contrato_id = ct.id);

-- 2.4 Atualizar referências vistoria_id em contratos
UPDATE contratos ct 
SET vistoria_id = v.id
FROM vistorias v 
WHERE v.contrato_id = ct.id 
AND ct.vistoria_id IS NULL;

-- 2.5 Atualizar vistorias existentes que não tem origem definida
UPDATE vistorias 
SET origem = 'manutencao' 
WHERE origem IS NULL;