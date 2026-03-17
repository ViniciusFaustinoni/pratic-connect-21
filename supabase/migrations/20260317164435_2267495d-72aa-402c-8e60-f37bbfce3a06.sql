-- Add 'regras_venda' to the check constraint for categoria
ALTER TABLE configuracoes DROP CONSTRAINT IF EXISTS configuracoes_categoria_check;
ALTER TABLE configuracoes ADD CONSTRAINT configuracoes_categoria_check 
  CHECK (categoria IN ('empresa', 'financeiro', 'operacional', 'notificacoes', 'atuarial', 'documentos', 'rateio', 'regras_venda'));

INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao) VALUES
('excecao_faixas_vendas', '[{"min":0,"max":9,"permitidas":0},{"min":10,"max":19,"permitidas":1},{"min":20,"max":29,"permitidas":2},{"min":30,"max":null,"permitidas":3}]', 'json', 'regras_venda', 'Faixas de vendas e solicitações de exceção permitidas por mês'),
('excecao_fipe_max_carro', '120000', 'numero', 'regras_venda', 'Valor máximo FIPE para carros em exceções'),
('excecao_fipe_max_moto', '27000', 'numero', 'regras_venda', 'Valor máximo FIPE para motos em exceções'),
('excecao_historico_boletos_ativo', 'true', 'booleano', 'regras_venda', 'Permitir exceção para associado ativo com histórico'),
('excecao_historico_boletos_minimo', '6', 'numero', 'regras_venda', 'Quantidade mínima de boletos para exceção'),
('excecao_zero_km_ativo', 'true', 'booleano', 'regras_venda', 'Permitir exceção para veículo 0km com NF'),
('restricao_mudanca_linha', 'true', 'booleano', 'regras_venda', 'Bloquear mudança de linha de produto'),
('restricao_depreciacao_cobertura_100', 'true', 'booleano', 'regras_venda', 'Bloquear depreciado em plano 100%'),
('restricao_blindado_absoluta', 'true', 'booleano', 'regras_venda', 'Bloquear blindados em qualquer hipótese')
ON CONFLICT (chave) DO NOTHING;