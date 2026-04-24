-- 1) Deduplicar cobrancas legadas com mesmo nosso_numero (manter o mais recente)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY nosso_numero
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.cobrancas
  WHERE nosso_numero IS NOT NULL AND nosso_numero <> ''
)
DELETE FROM public.cobrancas c
USING ranked r
WHERE c.id = r.id AND r.rn > 1;

-- 2) Índice único parcial — habilita ON CONFLICT (nosso_numero)
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_nosso_numero_uniq
  ON public.cobrancas (nosso_numero)
  WHERE nosso_numero IS NOT NULL AND nosso_numero <> '';

-- 3) Reabrir jobs falsos-concluídos para reprocessamento
UPDATE public.sga_sync_financeiro_jobs
SET status = 'pendente',
    boletos_importados = 0,
    concluido_em = NULL,
    ultimo_erro = NULL,
    tentativas = 0,
    proximo_retry_em = NULL,
    iniciado_em = NULL
WHERE status IN ('concluido', 'sem_historico_hinova')
  AND COALESCE(boletos_importados, 0) = 0;