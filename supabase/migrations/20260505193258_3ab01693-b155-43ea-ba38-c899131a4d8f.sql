
UPDATE public.veiculos
SET ativo=false, status='cancelado', data_inativacao=now(),
    motivo_inativacao='Atribuido por engano',
    updated_at=now()
WHERE id='7c6ef953-8251-4aad-b57d-6a0ec38170cc';

UPDATE public.sga_sync_queue
SET status='concluido',
    erro_ultimo='Veiculo fantasma — placa pertence a outro associado (Cristiano). Cancelado.'
WHERE veiculo_id='7c6ef953-8251-4aad-b57d-6a0ec38170cc';
