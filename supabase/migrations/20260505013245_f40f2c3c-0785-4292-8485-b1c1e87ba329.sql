-- Antecipar reenvio de itens pendentes recuperáveis para drenar a fila SGA agora
UPDATE public.sga_sync_queue
SET proximo_reenvio_em = now() - interval '1 minute'
WHERE status = 'pendente'
  AND etapa_parou IN ('associado','auth','veiculo')
  AND (proximo_reenvio_em IS NULL OR proximo_reenvio_em > now());