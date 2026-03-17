INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao)
VALUES 
  ('taxa_adesao_percentual_fipe', '1', 'numero', 'financeiro', 'Percentual sobre o valor FIPE para cálculo da taxa de adesão'),
  ('taxa_adesao_minimo_volante', '100', 'moeda', 'financeiro', 'Valor mínimo da taxa de adesão para vistoria volante (na residência)'),
  ('taxa_adesao_minimo_base', '100', 'moeda', 'financeiro', 'Valor mínimo da taxa de adesão para atendimento na base administrativa')
ON CONFLICT (chave) DO NOTHING;