
INSERT INTO configuracoes (chave, valor, tipo, categoria)
SELECT 'adicional_app', '35.90', c.tipo, c.categoria
FROM configuracoes c
LIMIT 1
ON CONFLICT (chave) DO NOTHING;
