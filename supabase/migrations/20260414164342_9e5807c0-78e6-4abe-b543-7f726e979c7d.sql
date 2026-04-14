
-- Adicionar coluna resetado_em para marcar corte de contexto
ALTER TABLE public.agente_ia_contatos 
ADD COLUMN IF NOT EXISTS resetado_em timestamptz DEFAULT NULL;

-- Criar índice para busca rápida de mensagens processadas por message_id (dedup)
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_message_id 
ON public.whatsapp_mensagens (message_id) 
WHERE message_id IS NOT NULL;
