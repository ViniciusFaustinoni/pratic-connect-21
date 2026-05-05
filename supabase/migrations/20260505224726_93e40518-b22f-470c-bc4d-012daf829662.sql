UPDATE public.whatsapp_meta_templates
SET variaveis_exemplo = jsonb_build_object(
  '1', 'João',
  '2', E'• Placa ABC1D23 — venc. 10/04/2026\n  34191090000034567890123456789012345678901234'
),
updated_at = now()
WHERE nome = 'cobranca_inadimplencia_pratic';