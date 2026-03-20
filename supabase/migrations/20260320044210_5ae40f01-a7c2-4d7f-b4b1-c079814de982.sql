
-- 1. Configuração: carência de vidros e faróis (valor padrão 120 dias)
INSERT INTO configuracoes (chave, valor, descricao, categoria, tipo, editavel)
VALUES (
  'carencia_beneficio_vidros_dias',
  '120',
  'Prazo de carência do benefício de vidros e faróis em dias',
  'regras_venda',
  'numero',
  true
)
ON CONFLICT (chave) DO NOTHING;

-- 2. Colunas de carência de vidros no contrato
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS data_carencia_vidros_inicio date;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS data_carencia_vidros_fim date;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS carencia_vidros_isenta boolean DEFAULT false;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS carencia_vidros_motivo_isencao text;
