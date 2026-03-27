
-- Fix region slugs in pricing table to match what the engine expects
UPDATE tabelas_preco_mensalidade SET regiao = 'rj' WHERE regiao = 'rio_de_janeiro';
UPDATE tabelas_preco_mensalidade SET regiao = 'lagos' WHERE regiao = 'regiao_dos_lagos';
