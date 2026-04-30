
UPDATE public.veiculos
SET codigo_fipe = '025233-2', updated_at = now()
WHERE id = '83b2a1e4-54c1-4b90-a9e6-c4469bc47ece' AND codigo_fipe IS NULL;

UPDATE public.sga_sync_queue
SET status = 'pendente',
    tentativas = 0,
    proximo_reenvio_em = now(),
    erro_ultimo = 'Reset manual: codigo_fipe preenchido (025233-2) — aguardando reprocessamento'
WHERE id = 'd05ddd39-5c6e-405d-b926-fc73253a39b5';
