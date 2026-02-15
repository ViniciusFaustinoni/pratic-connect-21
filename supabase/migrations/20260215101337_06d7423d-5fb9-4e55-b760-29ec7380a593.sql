INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES ('assistencia_telefone_central', '0800 980 0001', 'texto', 'empresa', 'Telefone 0800 da Assistência 24h (exibido no app e usado pela IA)', true)
ON CONFLICT (chave) DO NOTHING;