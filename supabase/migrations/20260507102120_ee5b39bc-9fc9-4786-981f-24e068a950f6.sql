
UPDATE public.documento_templates
SET
  document_type_id = (SELECT id FROM public.document_types WHERE code = 'termo_cancelamento' LIMIT 1),
  categoria_id = COALESCE(categoria_id, (SELECT id FROM public.documento_categorias WHERE nome = 'Termos' LIMIT 1)),
  ativo = true,
  is_default = true,
  status = 'active',
  updated_at = now()
WHERE codigo = 'TERMO_CANCELAMENTO_V1';
