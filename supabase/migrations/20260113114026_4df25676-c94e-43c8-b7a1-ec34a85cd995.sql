-- Adicionar campo para rastrear quando o email foi enviado
ALTER TABLE public.cotacoes 
ADD COLUMN email_enviado_em TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.cotacoes.email_enviado_em IS 'Data/hora em que o email da cotação foi enviado pela primeira vez';