-- Operação 1: Corrigir linha do ESPECIAL PLUS
UPDATE planos SET linha = 'especial-plus' WHERE id = '12cdd378-b42b-4389-a28f-1eba1fe7c837';

-- Operação 2a: SELECT BASIC → SELECT PREMIUM, SELECT EXCLUSIVE
INSERT INTO plano_elegibilidade_modelos 
  (plano_id, marca, modelo, ano_min, ano_max, combustivel, status, observacao, is_active, linha_slug)
SELECT 
  v.id, e.marca, e.modelo, e.ano_min, e.ano_max, 
  e.combustivel, e.status, e.observacao, e.is_active, e.linha_slug
FROM plano_elegibilidade_modelos e
JOIN planos base ON base.id = e.plano_id AND base.nome = 'SELECT BASIC'
JOIN planos v ON v.linha = 'select' AND v.nome != 'SELECT BASIC' AND v.ativo = true
WHERE NOT EXISTS (
  SELECT 1 FROM plano_elegibilidade_modelos x 
  WHERE x.plano_id = v.id AND x.marca = e.marca AND x.modelo = e.modelo
);

-- Operação 2b: SELECT ONE → SELECT ONE 5% PROMO
INSERT INTO plano_elegibilidade_modelos 
  (plano_id, marca, modelo, ano_min, ano_max, combustivel, status, observacao, is_active, linha_slug)
SELECT 
  v.id, e.marca, e.modelo, e.ano_min, e.ano_max, 
  e.combustivel, e.status, e.observacao, e.is_active, e.linha_slug
FROM plano_elegibilidade_modelos e
JOIN planos base ON base.id = e.plano_id AND base.nome = 'SELECT ONE'
JOIN planos v ON v.linha = 'select-one' AND v.nome != 'SELECT ONE' AND v.ativo = true
WHERE NOT EXISTS (
  SELECT 1 FROM plano_elegibilidade_modelos x 
  WHERE x.plano_id = v.id AND x.marca = e.marca AND x.modelo = e.modelo
);

-- Operação 2c: LANÇAMENTO BASIC → LANÇAMENTO PREMIUM, LANÇAMENTO EXCLUSIVE
INSERT INTO plano_elegibilidade_modelos 
  (plano_id, marca, modelo, ano_min, ano_max, combustivel, status, observacao, is_active, linha_slug)
SELECT 
  v.id, e.marca, e.modelo, e.ano_min, e.ano_max, 
  e.combustivel, e.status, e.observacao, e.is_active, e.linha_slug
FROM plano_elegibilidade_modelos e
JOIN planos base ON base.id = e.plano_id AND base.nome ilike 'LAN%AMENTO BASIC'
JOIN planos v ON v.linha = 'lancamento' AND v.nome NOT ilike 'LAN%AMENTO BASIC' AND v.ativo = true
WHERE NOT EXISTS (
  SELECT 1 FROM plano_elegibilidade_modelos x 
  WHERE x.plano_id = v.id AND x.marca = e.marca AND x.modelo = e.modelo
);

-- Operação 2d: ADVANCED → ADVANCED+
INSERT INTO plano_elegibilidade_modelos 
  (plano_id, marca, modelo, ano_min, ano_max, combustivel, status, observacao, is_active, linha_slug)
SELECT 
  v.id, e.marca, e.modelo, e.ano_min, e.ano_max, 
  e.combustivel, e.status, e.observacao, e.is_active, e.linha_slug
FROM plano_elegibilidade_modelos e
JOIN planos base ON base.id = e.plano_id AND base.nome = 'ADVANCED'
JOIN planos v ON v.linha = 'advanced' AND v.nome = 'ADVANCED+'
WHERE NOT EXISTS (
  SELECT 1 FROM plano_elegibilidade_modelos x 
  WHERE x.plano_id = v.id AND x.marca = e.marca AND x.modelo = e.modelo
);

-- Operação 3: Desativar planos App redundantes
UPDATE planos SET ativo = false 
WHERE id IN (
  'ba180738-4b11-4d7e-8ed0-7f73df3e5155',
  'fd6be7d7-6ec7-4d2c-8b56-cca80d14c3f4',
  '1addfd28-e67f-45da-8a87-efdb6311a32b'
);

-- Operação 4: Limpar plano_preco_map
DELETE FROM plano_preco_map 
WHERE plano_id IN (
  'ba180738-4b11-4d7e-8ed0-7f73df3e5155',
  'fd6be7d7-6ec7-4d2c-8b56-cca80d14c3f4',
  '1addfd28-e67f-45da-8a87-efdb6311a32b'
);