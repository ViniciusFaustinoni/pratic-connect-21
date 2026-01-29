-- Adicionar colunas de avaliação na tabela sinistros
ALTER TABLE public.sinistros 
ADD COLUMN IF NOT EXISTS avaliacao_nota INTEGER CHECK (avaliacao_nota >= 1 AND avaliacao_nota <= 5),
ADD COLUMN IF NOT EXISTS avaliacao_comentario TEXT,
ADD COLUMN IF NOT EXISTS avaliacao_data TIMESTAMP WITH TIME ZONE;

-- Índice para relatórios de NPS
CREATE INDEX IF NOT EXISTS idx_sinistros_avaliacao ON public.sinistros (avaliacao_nota) WHERE avaliacao_nota IS NOT NULL;

COMMENT ON COLUMN public.sinistros.avaliacao_nota IS 'Nota NPS de 1-5 dada pelo associado';
COMMENT ON COLUMN public.sinistros.avaliacao_comentario IS 'Comentário livre do associado sobre a análise';
COMMENT ON COLUMN public.sinistros.avaliacao_data IS 'Data/hora em que a avaliação foi enviada';