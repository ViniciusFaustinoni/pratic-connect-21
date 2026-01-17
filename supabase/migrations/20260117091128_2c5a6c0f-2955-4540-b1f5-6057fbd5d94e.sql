-- Adicionar configuração de Valor por Cota na categoria atuarial
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES (
  'atuarial_valor_por_cota',
  '5000',
  'moeda',
  'atuarial',
  'Valor em reais que representa uma cota. Usado para calcular o número de cotas de um veículo (FIPE / valor_cota = quantidade de cotas)',
  true
)
ON CONFLICT (chave) DO NOTHING;