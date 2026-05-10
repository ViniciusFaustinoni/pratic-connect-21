UPDATE public.veiculos
SET em_troca_titularidade = true,
    troca_titularidade_id = '31330683-a143-4a3e-9a1f-7db6d112a165',
    troca_titularidade_iniciada_em = '2026-05-10 20:17:48+00',
    updated_at = now()
WHERE id = '8a1b4af8-880c-4d71-b6f5-8e347c55fa3f'
  AND em_troca_titularidade = false;