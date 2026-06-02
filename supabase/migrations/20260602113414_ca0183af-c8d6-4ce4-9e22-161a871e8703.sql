-- Resumo opcional na pausa
ALTER TABLE public.whatsapp_ia_pausas
  ADD COLUMN IF NOT EXISTS resumo TEXT;

COMMENT ON COLUMN public.whatsapp_ia_pausas.resumo
  IS 'Resumo textual do motivo do transbordo (preenchido pela tool solicitar_atendente_humano da Maya IA).';

-- Locks de mensagem
CREATE TABLE IF NOT EXISTS public.agente_ia_locks (
  telefone        TEXT        NOT NULL,
  mensagem_hash   TEXT        NOT NULL,
  aberto_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  origem          TEXT,
  PRIMARY KEY (telefone, mensagem_hash)
);

CREATE INDEX IF NOT EXISTS idx_agente_ia_locks_aberto_em
  ON public.agente_ia_locks (aberto_em);

GRANT SELECT, INSERT, DELETE ON public.agente_ia_locks TO service_role;
ALTER TABLE public.agente_ia_locks ENABLE ROW LEVEL SECURITY;
-- Sem policies → só service_role acessa.

-- Claim atômico da fila da IA
CREATE OR REPLACE FUNCTION public.claim_proximos_itens_fila_ia(p_limit INTEGER DEFAULT 10)
RETURNS SETOF public.whatsapp_fila_ia
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidatos AS (
    SELECT id
    FROM public.whatsapp_fila_ia
    WHERE status IN ('pendente', 'erro')
      AND tentativas < 3
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 1)
  )
  UPDATE public.whatsapp_fila_ia f
     SET status = 'processando',
         tentativas = f.tentativas + 1
    FROM candidatos c
   WHERE f.id = c.id
  RETURNING f.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_proximos_itens_fila_ia(INTEGER) TO service_role;

-- Cron de limpeza dos locks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(j.jobid)
      FROM cron.job j
     WHERE j.jobname = 'agente_ia_locks_cleanup';

    PERFORM cron.schedule(
      'agente_ia_locks_cleanup',
      '*/15 * * * *',
      $cron$ DELETE FROM public.agente_ia_locks WHERE aberto_em < now() - interval '1 hour'; $cron$
    );
  END IF;
END $$;