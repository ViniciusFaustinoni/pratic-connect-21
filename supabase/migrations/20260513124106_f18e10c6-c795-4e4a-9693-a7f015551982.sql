
UPDATE public.whatsapp_mensagens
SET instancia_id = (SELECT id FROM public.whatsapp_instancias WHERE provedor='meta' AND ativa=true LIMIT 1)
WHERE instancia_id IS NULL
  AND (provedor='meta' OR referencia_tipo IN ('cobranca','cobranca_csv'));
