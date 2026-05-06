ALTER TABLE public.solicitacoes_troca_titularidade
  ADD COLUMN IF NOT EXISTS analise_previa_resultado jsonb,
  ADD COLUMN IF NOT EXISTS analise_previa_em timestamptz;