-- Adicionar coluna dados_parciais para persistir o progresso da vistoria
ALTER TABLE vistorias 
ADD COLUMN IF NOT EXISTS dados_parciais jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN vistorias.dados_parciais IS 
  'Dados parciais da vistoria em andamento (conferência, hodômetro, categorias abertas, etc)';

-- Criar índice para melhor performance em consultas
CREATE INDEX IF NOT EXISTS idx_vistorias_dados_parciais 
ON vistorias USING gin (dados_parciais);