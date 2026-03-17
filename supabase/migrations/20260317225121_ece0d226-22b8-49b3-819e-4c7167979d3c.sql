ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS whatsapp_enviado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_erro text;