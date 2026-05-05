
UPDATE public.veiculos
SET codigo_fipe = '005540-9', valor_fipe = 75922.00, updated_at = now()
WHERE id = '49639ef3-8b03-4ebf-9b5e-adb2b44a61a4';

UPDATE public.veiculos
SET ativo = false,
    status = 'cancelado',
    data_inativacao = now(),
    motivo_inativacao = 'Duplicata placa invalida',
    updated_at = now()
WHERE id = '5f4dcd29-c7ff-41eb-ae61-e1ac66d43e54';

UPDATE public.sga_sync_queue
SET status = 'concluido',
    erro_ultimo = 'Veiculo duplicado inativado manualmente — registro nao precisa ir ao SGA.'
WHERE veiculo_id = '5f4dcd29-c7ff-41eb-ae61-e1ac66d43e54';

UPDATE public.sga_sync_queue
SET status = 'pendente',
    tentativas = 0,
    erro_ultimo = NULL,
    etapa_parou = NULL,
    proximo_reenvio_em = now()
WHERE veiculo_id IN (
  '85d3e19a-a746-4513-9356-4089dd82e511',
  '49639ef3-8b03-4ebf-9b5e-adb2b44a61a4'
);
