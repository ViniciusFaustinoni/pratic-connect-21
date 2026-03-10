
-- Insert configuration records
INSERT INTO configuracoes (chave, valor, tipo, categoria)
VALUES
  ('carencia_dias_padrao', '120', 'numero', 'operacional'),
  ('carencia_dias_migracao', '0', 'numero', 'operacional'),
  ('multa_rastreador', '400', 'moeda', 'operacional'),
  ('taxa_repasse_volante', '50', 'moeda', 'operacional'),
  ('taxa_substituicao_placa', '50', 'moeda', 'operacional'),
  ('taxa_revistoria', '50', 'moeda', 'operacional'),
  ('taxa_troca_titularidade', '50', 'moeda', 'operacional'),
  ('cota_participacao_default', '6', 'numero', 'atuarial'),
  ('cota_minima_default', '1200', 'moeda', 'atuarial'),
  ('cota_desagio_default', '8', 'numero', 'atuarial'),
  ('cota_minima_desagio_default', '2000', 'moeda', 'atuarial')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, tipo = EXCLUDED.tipo, categoria = EXCLUDED.categoria;

-- Insert faixas_producao records
INSERT INTO faixas_producao (placas_min, placas_max, valor_bonus, descricao) VALUES
  (30, 39, 500, '30+ placas confirmadas'),
  (40, 49, 700, '40+ placas confirmadas'),
  (50, 59, 1000, '50+ placas confirmadas'),
  (60, 79, 1500, '60+ placas confirmadas'),
  (80, 99, 2000, '80+ placas confirmadas'),
  (100, NULL, 3000, '100+ placas confirmadas');
