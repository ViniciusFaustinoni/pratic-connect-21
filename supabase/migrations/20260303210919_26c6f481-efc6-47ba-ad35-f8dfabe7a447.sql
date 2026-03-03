ALTER TABLE public.despacho_reboque_convites 
ADD COLUMN IF NOT EXISTS etapa_conversacao text DEFAULT 'aguardando_sim';

COMMENT ON COLUMN public.despacho_reboque_convites.etapa_conversacao IS 'Etapa do fluxo conversacional WhatsApp: aguardando_sim → aguardando_localizacao → aguardando_aceite_valor → aceito/recusado';