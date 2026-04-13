UPDATE public.whatsapp_meta_templates 
SET nome = 'aprovacao_fipe_diretoria_v2', 
    status = 'PENDING',
    updated_at = now()
WHERE nome = 'aprovacao_fipe_diretoria_v1';