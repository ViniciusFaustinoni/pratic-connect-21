-- 1. Adicionar valor "recusado" ao enum status_veiculo
ALTER TYPE status_veiculo ADD VALUE IF NOT EXISTS 'recusado';

-- 2. Adicionar coluna vistoria_id à tabela blacklist_veiculos para rastrear a vistoria que originou o bloqueio
ALTER TABLE blacklist_veiculos 
ADD COLUMN IF NOT EXISTS vistoria_id UUID REFERENCES vistorias(id);