UPDATE public.whatsapp_meta_templates
SET status = 'DRAFT'
WHERE nome IN ('termo_filiacao_assinatura_v2', 'autorizacao_fipe_diretoria_v4')
  AND status = 'RASCUNHO';