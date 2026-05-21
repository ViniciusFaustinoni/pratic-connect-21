ALTER TABLE public.whatsapp_meta_templates
ADD COLUMN IF NOT EXISTS disparo_habilitado boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.whatsapp_meta_templates.disparo_habilitado IS
'Toggle local de disparo. Quando false, nenhum envio é feito mesmo com status APPROVED. Independente do status na Meta.';