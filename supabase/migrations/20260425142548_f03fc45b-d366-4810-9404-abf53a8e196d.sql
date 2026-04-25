
-- 1) Pausar drenagem em background
UPDATE public.sga_runtime_state
SET backfill_cancelar_solicitado = true,
    backfill_financeiro_ativo = false,
    updated_at = now();

-- 2) Limpar duplicatas em cobrancas (origem sga_hinova)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY veiculo_id, data_vencimento, valor, tipo
           ORDER BY
             CASE WHEN status = 'pago' THEN 0 ELSE 1 END,
             COALESCE(sincronizado_sga_em, updated_at, created_at) DESC,
             created_at DESC
         ) AS rn
  FROM public.cobrancas
  WHERE origem = 'sga_hinova'
    AND veiculo_id IS NOT NULL
    AND data_vencimento IS NOT NULL
)
DELETE FROM public.cobrancas c
USING ranked r
WHERE c.id = r.id AND r.rn > 1;

-- 3) Índice único composto para idempotência
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_sga_logica_uniq
  ON public.cobrancas (veiculo_id, data_vencimento, valor, tipo)
  WHERE origem = 'sga_hinova';

-- 4) Reagendar jobs travados por restrição de horário
UPDATE public.sga_sync_financeiro_jobs
SET status = 'pendente_retry',
    proximo_retry_em = now() + interval '5 minutes',
    updated_at = now()
WHERE status = 'erro'
  AND (ultimo_erro ILIKE '%time restriction%' OR ultimo_erro ILIKE '%horário%' OR ultimo_erro ILIKE '%horario%');
