UPDATE public.veiculos
   SET codigo_fipe = '811171-5',
       status_sga = 'pendente',
       updated_at = now()
 WHERE id = '72ab5c89-32b0-4abf-ad49-d5818571ded9';

UPDATE public.sga_sync_queue
   SET status = 'pendente',
       tentativas = 0,
       proximo_reenvio_em = now(),
       erro_ultimo = NULL
 WHERE veiculo_id = '72ab5c89-32b0-4abf-ad49-d5818571ded9';