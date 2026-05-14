CREATE INDEX IF NOT EXISTS idx_csv_boletos_dedupe_dia
  ON public.cobranca_csv_boletos (linha_digitavel, enviado_em DESC)
  WHERE status = 'enviado';

CREATE INDEX IF NOT EXISTS idx_csv_boletos_dedupe_fallback
  ON public.cobranca_csv_boletos (matricula, vencimento, enviado_em DESC)
  WHERE status = 'enviado';