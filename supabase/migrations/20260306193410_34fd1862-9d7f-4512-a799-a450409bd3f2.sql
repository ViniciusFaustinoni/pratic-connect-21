-- Fix ADVANCED plan: set cota_participacao and cota_minima for motorcycles
UPDATE planos 
SET cota_participacao = 10, cota_minima = 1500 
WHERE id = '28ef5622-82d3-4532-8a2c-db304233c414';