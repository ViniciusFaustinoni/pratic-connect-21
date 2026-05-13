UPDATE public.servicos s
SET profissional_id = v.vistoriador_id, updated_at = now()
FROM public.vistorias v
WHERE s.vistoria_origem_id = v.id
  AND s.profissional_id IS NULL
  AND v.vistoriador_id IS NOT NULL;