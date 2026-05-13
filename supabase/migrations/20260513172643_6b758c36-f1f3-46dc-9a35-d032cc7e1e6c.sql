UPDATE public.agendamentos_base
SET atendido_por = NULL,
    status = 'agendado',
    vistoria_id = NULL,
    updated_at = now()
WHERE id = '2ef48b2c-2c36-4c4b-9025-649d3c3cd649';