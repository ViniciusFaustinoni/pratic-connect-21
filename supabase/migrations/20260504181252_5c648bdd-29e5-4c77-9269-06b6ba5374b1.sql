
-- Gabriel (KPJ4994) e Edgar (TUM3D59) — reabrir itens travados em 'processando'
UPDATE public.sga_sync_queue
SET status = 'pendente',
    proximo_reenvio_em = now(),
    erro_ultimo = 'Reaberto após correção do guard base_antiga (associado já existe no SGA, apenas adicionando veículo)'
WHERE veiculo_id IN (
  'cde763e9-eb0e-4c23-bbb2-8a38de21264b',
  '55c2f9bc-9c16-4e63-a838-d2fbe143d5aa'
);

-- Mateus (RVH8J53) — inserir na fila (não havia registro)
INSERT INTO public.sga_sync_queue (veiculo_id, associado_id, status, origem, proximo_reenvio_em, tentativas, erro_ultimo)
VALUES (
  '92b19ba5-7884-4d48-b39e-09ea1d352ab5',
  'ec402b38-0936-4e6f-b25a-e12c8dffde1c',
  'pendente',
  'manual',
  now(),
  0,
  'Enfileirado manualmente — veículo estava com status_sga=pendente sem registro de fila'
)
ON CONFLICT DO NOTHING;

-- Resetar status_sga dos veículos para permitir nova tentativa limpa
UPDATE public.veiculos
SET status_sga = 'pendente'
WHERE id IN (
  'cde763e9-eb0e-4c23-bbb2-8a38de21264b',
  '55c2f9bc-9c16-4e63-a838-d2fbe143d5aa',
  '92b19ba5-7884-4d48-b39e-09ea1d352ab5'
);
