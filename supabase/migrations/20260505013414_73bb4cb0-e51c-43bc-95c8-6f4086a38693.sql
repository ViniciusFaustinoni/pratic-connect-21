UPDATE public.sga_sync_queue
SET tentativas = 0,
    proximo_reenvio_em = now() - interval '1 minute'
WHERE status = 'pendente'
  AND etapa_parou IN ('associado','auth','veiculo')
  AND tentativas >= 10;