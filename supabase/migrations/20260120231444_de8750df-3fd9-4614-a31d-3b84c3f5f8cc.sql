-- Criar vistorias para cotações que já tem agendamento mas não tem registro
INSERT INTO vistorias (
  cotacao_id,
  tipo,
  modalidade,
  status,
  origem,
  data_agendada,
  horario_agendado,
  endereco_cep,
  endereco_logradouro,
  endereco_numero,
  endereco_bairro,
  endereco_cidade,
  endereco_estado,
  endereco_latitude,
  endereco_longitude
)
SELECT 
  c.id,
  'entrada',
  'presencial',
  'pendente',
  'cotacao',
  c.vistoria_data_agendada,
  c.vistoria_horario_agendado::time,
  c.vistoria_endereco_cep,
  c.vistoria_endereco_logradouro,
  c.vistoria_endereco_numero,
  c.vistoria_endereco_bairro,
  c.vistoria_endereco_cidade,
  c.vistoria_endereco_estado,
  c.vistoria_endereco_latitude,
  c.vistoria_endereco_longitude
FROM cotacoes c
LEFT JOIN vistorias v ON v.cotacao_id = c.id
WHERE c.vistoria_data_agendada IS NOT NULL
  AND c.tipo_vistoria = 'agendada'
  AND v.id IS NULL;

-- Atualizar contratos com vistoria_id das vistorias criadas
UPDATE contratos con
SET vistoria_id = v.id
FROM vistorias v
WHERE v.cotacao_id = con.cotacao_id
  AND con.vistoria_id IS NULL
  AND v.id IS NOT NULL;