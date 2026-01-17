-- Gerar token_publico para cotações existentes que não possuem
UPDATE cotacoes 
SET token_publico = encode(gen_random_bytes(32), 'hex')
WHERE token_publico IS NULL;