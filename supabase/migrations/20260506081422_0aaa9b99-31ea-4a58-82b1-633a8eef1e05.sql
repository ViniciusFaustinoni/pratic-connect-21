-- 1) cobranca_csv_boletos: novo campo motivo_recuperacao
ALTER TABLE public.cobranca_csv_boletos
  ADD COLUMN IF NOT EXISTS motivo_recuperacao text;

COMMENT ON COLUMN public.cobranca_csv_boletos.motivo_recuperacao IS
  'Quando status=recuperado: ausente_na_nova_lista (associado sumiu) | reemitido (mesma matrícula, nova linha digitável)';

-- 2) cobranca_csv_lotes: novo contador + status processando
ALTER TABLE public.cobranca_csv_lotes
  ADD COLUMN IF NOT EXISTS total_associados_atingidos integer NOT NULL DEFAULT 0;

-- Se houver CHECK constraint no status, ajustar para incluir 'processando'.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.cobranca_csv_lotes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.cobranca_csv_lotes DROP CONSTRAINT %I', con_name);
  END IF;
END$$;

ALTER TABLE public.cobranca_csv_lotes
  ADD CONSTRAINT cobranca_csv_lotes_status_chk
  CHECK (status IN ('processando', 'ativo', 'substituido', 'cancelado'));

-- 3) Índice para a aba Recuperados (filtro por período + status)
CREATE INDEX IF NOT EXISTS idx_cobranca_csv_boletos_recuperado_em
  ON public.cobranca_csv_boletos (recuperado_em DESC)
  WHERE status = 'recuperado';

CREATE INDEX IF NOT EXISTS idx_cobranca_csv_boletos_lote_status
  ON public.cobranca_csv_boletos (lote_id, status);