UPDATE public.cotacoes_vistoria_fotos
SET tipo = 'motor'
WHERE tipo IN ('frente','frente_centro')
  AND cotacao_id IN ('68e0ede7-0767-4749-bab0-41099fe29bee','7f66c5da-e12c-4bf2-ac56-ba85c57a8aca');

UPDATE public.vistoria_fotos
SET tipo = 'motor'
WHERE tipo IN ('frente','frente_centro')
  AND vistoria_id = 'f25cab20-297c-43ec-baaa-f3fcf4501b33';