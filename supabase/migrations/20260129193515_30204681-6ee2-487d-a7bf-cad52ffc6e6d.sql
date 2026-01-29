-- Adicionar campos de avaliação na tabela chamados_assistencia
ALTER TABLE chamados_assistencia
ADD COLUMN IF NOT EXISTS avaliacao_nota INTEGER CHECK (avaliacao_nota >= 1 AND avaliacao_nota <= 5),
ADD COLUMN IF NOT EXISTS avaliacao_comentario TEXT,
ADD COLUMN IF NOT EXISTS avaliacao_data TIMESTAMP WITH TIME ZONE;

-- Comentário nos campos
COMMENT ON COLUMN chamados_assistencia.avaliacao_nota IS 'Nota de 1 a 5 dada pelo associado ao atendimento';
COMMENT ON COLUMN chamados_assistencia.avaliacao_comentario IS 'Comentário opcional do associado sobre o atendimento';
COMMENT ON COLUMN chamados_assistencia.avaliacao_data IS 'Data/hora em que a avaliação foi registrada';