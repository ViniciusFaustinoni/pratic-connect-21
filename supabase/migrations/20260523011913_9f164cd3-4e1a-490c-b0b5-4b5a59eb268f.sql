
UPDATE public.contratos
SET vendedor_id = 'a90765fd-520a-4651-86e4-c3ceda030ec1', updated_at = now()
WHERE id = '7f9bce06-3202-4086-b1ed-ec189433311d';

UPDATE public.sga_sync_queue
SET status = 'pendente',
    tentativas = 0,
    erro_ultimo = NULL,
    etapa_parou = NULL,
    proximo_reenvio_em = now(),
    ultima_tentativa_em = NULL
WHERE id = 'c6c6bd0d-e70a-4a7d-be7f-17e1ee318114';
