UPDATE public.associados SET cep='21660-050', updated_at=now() WHERE id='5e60854a-0779-43db-b4d0-ea26d26d98a3';

UPDATE public.sga_sync_queue
SET status='pendente', tentativas=0, proximo_reenvio_em=now(), erro_ultimo=NULL, etapa_parou=NULL
WHERE veiculo_id='97530643-05bd-4d22-a4e2-c445bb2a85b2' AND associado_id='5e60854a-0779-43db-b4d0-ea26d26d98a3';