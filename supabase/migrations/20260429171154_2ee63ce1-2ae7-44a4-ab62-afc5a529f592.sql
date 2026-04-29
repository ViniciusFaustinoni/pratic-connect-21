-- Resetar sincronização SGA do veículo HOA1B39 (Vinicius) após correção do bug de reauth
UPDATE public.veiculos
SET status_sga = 'pendente'
WHERE id = 'c52c4b7f-d879-4d10-8fe9-68ccacd064eb'
  AND status_sga = 'erro_sincronizacao';

UPDATE public.sga_sync_queue
SET status = 'pendente',
    tentativas = 0,
    proximo_reenvio_em = now(),
    erro_ultimo = 'Reset manual após correção do bug de reauth Hinova (sessão invalidada por reautenticação concorrente)'
WHERE veiculo_id = 'c52c4b7f-d879-4d10-8fe9-68ccacd064eb';