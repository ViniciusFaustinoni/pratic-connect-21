UPDATE public.veiculos
SET codigo_fipe='011116-3',
    valor_fipe=36262.00,
    modelo='C3 Origine 1.5 Flex 8V 5p Mec.',
    combustivel='ALCOOL/GASOLINA',
    updated_at=now()
WHERE id='2f162355-b89d-462b-92ce-a76f7e979049';

UPDATE public.sga_sync_queue
SET status='pendente',
    tentativas=0,
    erro_ultimo=NULL,
    proximo_reenvio_em=now(),
    ultima_tentativa_em=NULL
WHERE id='e3047182-c278-406c-9db5-3a5e43b34dd3';