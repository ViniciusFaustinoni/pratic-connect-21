
INSERT INTO public.whatsapp_instancias (nome, instance_name, api_url, provedor, ativa, status)
SELECT 'Meta WhatsApp', 'meta-whatsapp', 'https://graph.facebook.com', 'meta', true, 'open'
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_instancias WHERE provedor='meta'
);
