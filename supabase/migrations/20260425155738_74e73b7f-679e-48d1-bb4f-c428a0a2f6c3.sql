-- Cleanup de duplicatas: mantém o melhor job por (veiculo_id, tipo)
-- Prioridade: concluido(1) > erro(2) > pendente_retry(3) > pendente(4) > executando(5)
-- Em empate, mantém o mais recente por updated_at
WITH ranked AS (
  SELECT id,
         veiculo_id,
         tipo,
         status,
         updated_at,
         ROW_NUMBER() OVER (
           PARTITION BY veiculo_id, tipo
           ORDER BY 
             CASE status::text
               WHEN 'concluido' THEN 1
               WHEN 'erro' THEN 2
               WHEN 'pendente_retry' THEN 3
               WHEN 'pendente' THEN 4
               WHEN 'executando' THEN 5
               ELSE 9
             END,
             updated_at DESC
         ) AS rn
  FROM public.sga_sync_financeiro_jobs
  WHERE status <> 'cancelado'
),
to_cancel AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE public.sga_sync_financeiro_jobs j
SET status = 'cancelado',
    ultimo_erro = COALESCE(j.ultimo_erro, '') || ' | duplicata_dedupe_2026-04-25',
    updated_at = now()
FROM to_cancel
WHERE j.id = to_cancel.id;