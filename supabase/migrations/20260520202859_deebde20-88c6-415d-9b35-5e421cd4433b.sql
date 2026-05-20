
UPDATE public.veiculos
SET em_troca_titularidade = false,
    troca_titularidade_id = NULL,
    troca_titularidade_iniciada_em = NULL,
    cobertura_suspensa = false,
    cobertura_suspensa_motivo = NULL,
    cobertura_suspensa_em = NULL,
    codigo_hinova = NULL,
    sincronizado_hinova = false,
    sincronizado_hinova_em = NULL,
    updated_at = now()
WHERE id = 'd5181403-22c0-4f2a-b22e-b6e7d821376c';

DELETE FROM public.solicitacoes_troca_titularidade
WHERE id = '2ee5c642-a095-4423-9a9d-06dc1282ea9d';

DELETE FROM public.cotacoes
WHERE id = '97f3142d-273b-4438-a1aa-47a129c102ce';

DELETE FROM public.contratos
WHERE id = 'e5a02908-b5e3-482c-a063-365a92477d71';

DELETE FROM public.associados
WHERE id = '5e83b57a-04b9-433c-9a0b-dcd0e2ab0f49';
