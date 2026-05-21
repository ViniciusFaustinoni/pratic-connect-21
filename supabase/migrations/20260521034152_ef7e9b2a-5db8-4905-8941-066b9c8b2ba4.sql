UPDATE public.veiculos
SET em_troca_titularidade = true,
    updated_at = now()
WHERE placa = 'KOU6D37'
  AND troca_titularidade_id = 'bb49bf56-d19f-47ef-bdad-1e748f51541e'
  AND em_troca_titularidade = false;