-- Add 'indicacao' to the categoria check constraint
ALTER TABLE configuracoes DROP CONSTRAINT IF EXISTS configuracoes_categoria_check;
ALTER TABLE configuracoes ADD CONSTRAINT configuracoes_categoria_check CHECK (categoria IN ('empresa', 'financeiro', 'operacional', 'notificacoes', 'documentos', 'atuarial', 'rateio', 'regras_venda', 'indicacao'));

INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao) VALUES
  ('indicacao_validade_dias', '30', 'numero', 'indicacao', 'Prazo em dias para validade de uma indicação antes de expirar'),
  ('indicacao_valor_recompensa', '50', 'numero', 'indicacao', 'Valor monetário da recompensa para o associado indicador'),
  ('indicacao_momento_pagamento', 'apos_conversao', 'texto', 'indicacao', 'Momento do pagamento da recompensa: apos_conversao ou apos_primeiro_boleto'),
  ('indicacao_gera_pontuacao_consultor', 'true', 'booleano', 'indicacao', 'Se indicação convertida gera pontuação para o consultor')
ON CONFLICT (chave) DO NOTHING;