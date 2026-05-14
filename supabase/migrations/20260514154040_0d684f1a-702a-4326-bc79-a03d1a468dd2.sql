-- 1) Amplia o CHECK de status para aceitar 'parcial'
ALTER TABLE public.cobranca_csv_lotes DROP CONSTRAINT IF EXISTS cobranca_csv_lotes_status_chk;
ALTER TABLE public.cobranca_csv_lotes
  ADD CONSTRAINT cobranca_csv_lotes_status_chk
  CHECK (status = ANY (ARRAY['processando','ativo','parcial','substituido','cancelado']));

-- 2) Saneia lotes presos em processando com envios reais
UPDATE public.cobranca_csv_lotes
SET status = 'parcial'
WHERE status = 'processando'
  AND COALESCE(total_enviados, 0) > 0;

-- 3) Cancela lotes processando sem envio e sem boletos
UPDATE public.cobranca_csv_lotes l
SET status = 'cancelado'
WHERE l.status = 'processando'
  AND COALESCE(l.total_enviados, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM public.cobranca_csv_boletos b WHERE b.lote_id = l.id);

-- 4) Índice de idempotência
CREATE INDEX IF NOT EXISTS idx_cobranca_csv_boletos_lote_matricula_status
  ON public.cobranca_csv_boletos (lote_id, matricula, status);