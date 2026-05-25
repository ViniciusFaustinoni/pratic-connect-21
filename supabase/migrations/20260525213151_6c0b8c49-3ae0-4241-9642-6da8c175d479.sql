ALTER TABLE public.cobranca_csv_lotes
  ADD COLUMN IF NOT EXISTS template_nome text,
  ADD COLUMN IF NOT EXISTS var_mapping_snapshot jsonb;