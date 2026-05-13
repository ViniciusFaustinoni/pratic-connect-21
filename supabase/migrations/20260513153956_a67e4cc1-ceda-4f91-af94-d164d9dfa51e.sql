UPDATE public.servicos
SET status='agendada',
    profissional_id='f6313b28-d376-4b82-8b1b-0b77d2c3c8dc',
    local_vistoria='base',
    data_agendada='2026-05-13',
    periodo='tarde',
    iniciada_em=NULL,
    em_rota_em=NULL,
    observacoes = COALESCE(observacoes,'') || E'\n[2026-05-13 CORREÇÃO RAIZ] Restaurado para fila do Wallace após bug de realocação para base.',
    updated_at=now()
WHERE id='18dcc8fb-ea3a-4fce-9b80-59141a81f451';

UPDATE public.instalacoes
SET status='agendada',
    instalador_responsavel_id='f6313b28-d376-4b82-8b1b-0b77d2c3c8dc',
    data_agendada='2026-05-13',
    periodo='tarde',
    updated_at=now()
WHERE id='1a98a673-3daf-4c12-857b-b069a999d796';