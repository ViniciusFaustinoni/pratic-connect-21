
-- Add 'rateio' to allowed categories
ALTER TABLE configuracoes DROP CONSTRAINT configuracoes_categoria_check;
ALTER TABLE configuracoes ADD CONSTRAINT configuracoes_categoria_check 
  CHECK (categoria::text = ANY (ARRAY['empresa','financeiro','operacional','notificacoes','integracao','seguranca','atuarial','rateio']::text[]));

-- Insert rateio config keys
INSERT INTO configuracoes (chave, valor, descricao, tipo, categoria) VALUES
  ('rateio_multiplicador_passeio', '1.0', 'Multiplicador de cotas para veículos de passeio', 'numero', 'rateio'),
  ('rateio_multiplicador_aplicativo', '1.3', 'Multiplicador de cotas para veículos de aplicativo (Uber/99)', 'numero', 'rateio'),
  ('rateio_multiplicador_diesel', '1.2', 'Multiplicador de cotas para veículos diesel', 'numero', 'rateio'),
  ('rateio_multiplicador_moto', '1.5', 'Multiplicador de cotas para motos', 'numero', 'rateio'),
  ('rateio_taxa_administrativa', '29.90', 'Taxa administrativa mensal fixa por associado', 'moeda', 'rateio'),
  ('rateio_dia_fechamento', '25', 'Dia do mês para fechamento do rateio', 'numero', 'rateio'),
  ('rateio_dia_vencimento', '10', 'Dia do mês para vencimento dos boletos', 'numero', 'rateio')
ON CONFLICT (chave) DO NOTHING;
