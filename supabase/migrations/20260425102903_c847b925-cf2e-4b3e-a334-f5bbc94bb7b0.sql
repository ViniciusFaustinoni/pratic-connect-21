
WITH ativos AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY veiculo_id
      ORDER BY
        CASE tipo
          WHEN 'backfill_inicial' THEN 1
          WHEN 'resync'           THEN 2
          WHEN 'mapear_codigo'    THEN 3
          ELSE 9
        END,
        created_at ASC NULLS LAST,
        id ASC
    ) AS rn
  FROM public.sga_sync_financeiro_jobs
  WHERE status IN ('pendente', 'pendente_retry', 'executando')
    AND veiculo_id IS NOT NULL
)
UPDATE public.sga_sync_financeiro_jobs j
   SET status = 'cancelado',
       ultimo_erro = 'dedupe_consolidacao',
       updated_at = now()
  FROM ativos a
 WHERE j.id = a.id
   AND a.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sga_sync_fin_jobs_veiculo_ativo
  ON public.sga_sync_financeiro_jobs (veiculo_id)
  WHERE status IN ('pendente', 'pendente_retry', 'executando');
