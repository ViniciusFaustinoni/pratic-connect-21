-- Reprocessar fila SGA: veículos 0KM presos por validação de RENAVAM
-- e limpar placeholder "0000000" que estava sendo enviado para a Hinova.

-- 1) Limpar renavam placeholder (somente zeros) em veículos
UPDATE public.veiculos
SET renavam = NULL
WHERE renavam IS NOT NULL
  AND regexp_replace(renavam, '\D', '', 'g') ~ '^0+$';

-- 2) Reenfileirar veículos 0KM travados na fila SGA por RENAVAM obrigatório
--    e o caso 0KM91CD6 que tinha placeholder
UPDATE public.sga_sync_queue
SET status = 'pendente',
    tentativas = 0,
    erro_ultimo = NULL,
    proximo_reenvio_em = now()
WHERE veiculo_id IN (
  'c1409932-2be4-4edd-8da1-a17dee56dca0',
  'a5d95c57-176a-4d2d-a9aa-c9c305dd002c',
  'a5ee64e4-af58-4b79-bec1-abdeff267cde',
  '99e42b52-1168-424e-9a3a-cce6fc9b94a1'
);