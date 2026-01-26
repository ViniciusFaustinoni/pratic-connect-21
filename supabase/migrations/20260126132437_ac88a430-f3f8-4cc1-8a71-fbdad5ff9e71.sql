-- Adicionar coluna para habilitar/desabilitar IA na instância WhatsApp
ALTER TABLE public.whatsapp_instancias 
ADD COLUMN IF NOT EXISTS ia_habilitada BOOLEAN NOT NULL DEFAULT true;

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_instancias.ia_habilitada IS 'Controla se a IA responde automaticamente mensagens nesta instância';