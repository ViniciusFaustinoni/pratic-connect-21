BEGIN;

UPDATE public.vistorias
SET status = 'em_analise',
    updated_at = now()
WHERE id = '8caff0de-7383-4456-bc53-0c16b8c559ad';

UPDATE public.servicos
SET tipo = 'instalacao',
    status = 'em_andamento',
    etapa_atual = 4,
    profissional_id = 'f6313b28-d376-4b82-8b1b-0b77d2c3c8dc',
    vistoria_origem_id = '8caff0de-7383-4456-bc53-0c16b8c559ad',
    concluida_em = NULL,
    updated_at = now()
WHERE id = '39a5b00d-691c-40e6-ba1c-981f34d8d8e0';

COMMIT;