-- Corrigir associado de teste: criar veículo a partir dos dados do contrato
-- e vincular ao contrato

-- 1. Inserir veículo para o associado de teste
INSERT INTO veiculos (
  associado_id,
  placa,
  marca,
  modelo,
  ano_fabricacao,
  ano_modelo,
  valor_fipe,
  status,
  cobertura_roubo_furto,
  cobertura_total
)
SELECT 
  c.associado_id,
  c.veiculo_placa,
  c.veiculo_marca,
  c.veiculo_modelo,
  c.veiculo_ano,
  c.veiculo_ano,
  c.veiculo_valor_fipe,
  'instalacao_pendente',
  true,
  false
FROM contratos c
WHERE c.associado_id IS NOT NULL
  AND c.veiculo_id IS NULL
  AND c.veiculo_placa IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2. Atualizar contratos para vincular aos veículos recém-criados
UPDATE contratos c
SET veiculo_id = v.id
FROM veiculos v
WHERE c.associado_id = v.associado_id
  AND c.veiculo_placa = v.placa
  AND c.veiculo_id IS NULL;