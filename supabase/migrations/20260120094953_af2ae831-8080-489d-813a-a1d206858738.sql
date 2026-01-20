-- Backfill: Criar instalações para associados aguardando instalação que não têm instalação criada
-- Isso corrige o caso onde a aprovação falhou em criar a instalação devido a status inválido

INSERT INTO instalacoes (
  associado_id,
  veiculo_id,
  contrato_id,
  status,
  data_agendada,
  periodo,
  logradouro,
  numero,
  bairro,
  cidade,
  uf,
  cep
)
SELECT 
  a.id AS associado_id,
  v.id AS veiculo_id,
  c.id AS contrato_id,
  'agendada' AS status,
  CURRENT_DATE AS data_agendada,
  'manha' AS periodo,
  a.logradouro,
  a.numero,
  a.bairro,
  a.cidade,
  a.uf,
  a.cep
FROM associados a
JOIN veiculos v ON v.associado_id = a.id
JOIN contratos c ON c.associado_id = a.id AND c.status = 'ativo'
WHERE a.status = 'aguardando_instalacao'
  AND NOT EXISTS (
    SELECT 1 FROM instalacoes i WHERE i.associado_id = a.id
  );