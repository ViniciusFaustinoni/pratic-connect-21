ALTER TABLE public.cobranca_csv_boletos
  ADD COLUMN IF NOT EXISTS associado_id uuid REFERENCES public.associados(id),
  ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id),
  ADD COLUMN IF NOT EXISTS match_origem text,
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS status_origem text,
  ADD COLUMN IF NOT EXISTS cpf text;

CREATE INDEX IF NOT EXISTS idx_csv_boletos_associado ON public.cobranca_csv_boletos(associado_id);
CREATE INDEX IF NOT EXISTS idx_csv_boletos_veiculo  ON public.cobranca_csv_boletos(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_csv_boletos_lote_status ON public.cobranca_csv_boletos(lote_id, status);
CREATE INDEX IF NOT EXISTS idx_csv_boletos_match_origem ON public.cobranca_csv_boletos(match_origem);
