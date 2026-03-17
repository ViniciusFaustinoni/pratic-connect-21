INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao)
VALUES ('taxa_repasse_volante_externo', '50', 'moeda', 'operacional', 'Repasse obrigatório para instalações volante realizadas por vendedores externos')
ON CONFLICT (chave) DO NOTHING;