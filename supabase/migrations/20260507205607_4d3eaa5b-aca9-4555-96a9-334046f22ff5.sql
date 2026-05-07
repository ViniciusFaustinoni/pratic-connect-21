UPDATE public.sga_sync_queue
SET status = 'pendente', tentativas = 0, erro_ultimo = NULL, proximo_reenvio_em = now()
WHERE veiculo_id IN (
  '3d332af3-76a1-47d7-91be-d31c34e10986',
  '3d0fed0d-40ec-459b-9de3-d9178b1c5058',
  'ec728520-e26c-4319-ab73-a7323e52e101',
  '72ab5c89-32b0-4abf-ad49-d5818571ded9'
);