
UPDATE public.associados SET cep='24344104', updated_at=now() WHERE id='326992ab-b0b7-4aa6-a7ed-3cf8a7b5c79d';

UPDATE public.sga_sync_queue
SET status='pendente', tentativas=0, erro_ultimo=NULL, etapa_parou=NULL, proximo_reenvio_em=now()
WHERE veiculo_id='a1765caa-3bcb-4160-b655-98fadd6dacf8';
