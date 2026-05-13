UPDATE public.whatsapp_meta_templates
SET status = 'DRAFT'
WHERE status = 'PENDING'
  AND meta_template_id IS NULL
  AND enviado_em IS NULL;