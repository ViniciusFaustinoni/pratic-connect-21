-- Atualizar contratos existentes com dados do veículo da cotação
UPDATE contratos c
SET 
  veiculo_valor_fipe = cot.valor_fipe,
  veiculo_marca = cot.veiculo_marca,
  veiculo_modelo = cot.veiculo_modelo,
  veiculo_ano = cot.veiculo_ano,
  veiculo_placa = cot.veiculo_placa,
  cliente_nome = COALESCE(c.cliente_nome, l.nome),
  cliente_email = COALESCE(c.cliente_email, l.email),
  cliente_telefone = COALESCE(c.cliente_telefone, l.telefone),
  cliente_cpf = COALESCE(c.cliente_cpf, l.cpf)
FROM cotacoes cot
LEFT JOIN leads l ON cot.lead_id = l.id
WHERE c.cotacao_id = cot.id
  AND c.veiculo_valor_fipe IS NULL
  AND cot.valor_fipe IS NOT NULL;