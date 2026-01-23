-- Adicionar campos de controle de tempo para métricas

-- Tabela vistorias: campos de timestamp para calcular tempo
ALTER TABLE vistorias 
ADD COLUMN IF NOT EXISTS em_rota_em TIMESTAMPTZ;

ALTER TABLE vistorias 
ADD COLUMN IF NOT EXISTS iniciada_em TIMESTAMPTZ;

ALTER TABLE vistorias 
ADD COLUMN IF NOT EXISTS concluida_em TIMESTAMPTZ;

-- Tabela instalacoes: campo específico para registro de em_rota
-- (já tem iniciada_em e concluida_em)
ALTER TABLE instalacoes
ADD COLUMN IF NOT EXISTS em_rota_em TIMESTAMPTZ;

-- Comentários descritivos
COMMENT ON COLUMN vistorias.em_rota_em IS 'Timestamp de quando a vistoria foi atribuída e entrou em status em_rota';
COMMENT ON COLUMN vistorias.iniciada_em IS 'Timestamp de quando o vistoriador iniciou a execução da vistoria';
COMMENT ON COLUMN vistorias.concluida_em IS 'Timestamp de quando a vistoria foi concluída';
COMMENT ON COLUMN instalacoes.em_rota_em IS 'Timestamp de quando a instalação foi atribuída e entrou em status em_rota';