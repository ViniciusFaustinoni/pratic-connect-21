-- Fix ESPECIAL PLUS: tipo_uso should be 'particular' not 'passeio'
UPDATE plano_preco_map SET tipo_uso = 'particular' 
WHERE plano_id = '12cdd378-b42b-4389-a28f-1eba1fe7c837';

-- Add missing SELECT EXCLUSIVE mapping
INSERT INTO plano_preco_map (plano_id, linha_slug, tipo_uso) 
VALUES ('43fe1e6a-374e-4b69-a76b-aea3f142b3c1', 'select', 'particular');