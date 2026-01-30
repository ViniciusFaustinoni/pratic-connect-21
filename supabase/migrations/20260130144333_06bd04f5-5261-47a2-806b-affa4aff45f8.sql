-- Adicionar coluna alerta_recem_ativado na tabela sinistros
ALTER TABLE sinistros 
ADD COLUMN IF NOT EXISTS alerta_recem_ativado BOOLEAN DEFAULT false;

COMMENT ON COLUMN sinistros.alerta_recem_ativado IS 
'Indica se o sinistro foi aberto por associado recém-ativado (sem rastreador instalado). Requer análise especial.';