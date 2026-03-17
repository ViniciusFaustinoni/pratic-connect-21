INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao)
VALUES
  ('taxa_adesao_minimo_volante_interno', '150', 'moeda', 'financeiro', 'Mínimo adesão volante - vendedor CLT'),
  ('taxa_adesao_minimo_volante_externo', '50', 'moeda', 'financeiro', 'Mínimo adesão volante - vendedor externo')
ON CONFLICT (chave) DO NOTHING;