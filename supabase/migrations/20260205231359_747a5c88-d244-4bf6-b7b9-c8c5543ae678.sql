-- Adicionar colunas de período na tabela cotacoes
ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS vistoria_periodo TEXT 
CHECK (vistoria_periodo IN ('manha', 'tarde'));

ALTER TABLE cotacoes 
ADD COLUMN IF NOT EXISTS vistoria_completa_periodo TEXT 
CHECK (vistoria_completa_periodo IN ('manha', 'tarde'));