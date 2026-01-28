-- Corrigir coordenadas na instalação e serviço do MARCUS VINICIUS
-- Endereço: EST CAFUNDA, 725, TANQUE, RIO DE JANEIRO, RJ
-- Coordenadas geocodificadas: -22.9151927, -43.3557471

UPDATE instalacoes
SET endereco_latitude = -22.9151927,
    endereco_longitude = -43.3557471,
    updated_at = now()
WHERE id = 'ca79d033-abbe-4767-8ad7-999d5c03130d';

UPDATE servicos
SET latitude = -22.9151927,
    longitude = -43.3557471,
    updated_at = now()
WHERE id = 'bf662bc2-29f1-4de1-8d1e-17bf5c672854';