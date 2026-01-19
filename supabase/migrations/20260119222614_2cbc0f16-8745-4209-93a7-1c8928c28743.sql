-- Inserir vistorias para cotações que já agendaram vistoria completa mas não têm registro em vistorias
INSERT INTO vistorias (
  cotacao_id, contrato_id, associado_id, veiculo_id,
  tipo, modalidade, status, origem,
  data_agendada, horario_agendado,
  endereco_cep, endereco_logradouro, endereco_numero,
  endereco_bairro, endereco_cidade, endereco_estado,
  endereco_latitude, endereco_longitude,
  observacoes
)
SELECT 
  c.id as cotacao_id,
  ct.id as contrato_id,
  ct.associado_id,
  ct.veiculo_id,
  'entrada',
  'presencial',
  'agendada',
  'cotacao',
  c.vistoria_completa_data_agendada,
  c.vistoria_completa_horario_agendado::time,
  c.vistoria_completa_endereco_cep,
  c.vistoria_completa_endereco_logradouro,
  c.vistoria_completa_endereco_numero,
  c.vistoria_completa_endereco_bairro,
  c.vistoria_completa_endereco_cidade,
  c.vistoria_completa_endereco_estado,
  c.vistoria_endereco_latitude,
  c.vistoria_endereco_longitude,
  CONCAT('Responsável: ', 
    CASE WHEN c.vistoria_completa_responsavel_eu_mesmo = true THEN c.nome_solicitante ELSE COALESCE(c.vistoria_completa_responsavel_nome, c.nome_solicitante) END,
    ' - ',
    CASE WHEN c.vistoria_completa_responsavel_eu_mesmo = true THEN c.telefone1_solicitante ELSE COALESCE(c.vistoria_completa_responsavel_telefone, c.telefone1_solicitante) END
  )
FROM cotacoes c
LEFT JOIN contratos ct ON ct.cotacao_id = c.id
WHERE c.vistoria_completa_data_agendada IS NOT NULL
  AND c.vistoria_concluida_em IS NULL
  AND c.tipo_vistoria = 'autovistoria'
  AND NOT EXISTS (
    SELECT 1 FROM vistorias v 
    WHERE v.cotacao_id = c.id 
    AND v.modalidade = 'presencial'
  );