-- Dedup existing boletos: keep oldest by linha_digitavel
DELETE FROM public.cobranca_csv_boletos a
USING public.cobranca_csv_boletos b
WHERE a.linha_digitavel = b.linha_digitavel
  AND a.created_at > b.created_at;

-- Tie-breaker for identical timestamps
DELETE FROM public.cobranca_csv_boletos a
USING public.cobranca_csv_boletos b
WHERE a.linha_digitavel = b.linha_digitavel
  AND a.id > b.id;

-- Unique index to enforce dedup at DB level
CREATE UNIQUE INDEX IF NOT EXISTS cobranca_csv_boletos_linha_uq
  ON public.cobranca_csv_boletos(linha_digitavel);