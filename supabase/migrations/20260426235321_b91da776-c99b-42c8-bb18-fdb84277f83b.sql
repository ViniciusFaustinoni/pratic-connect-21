ALTER TABLE public.vistoria_links
  ADD COLUMN IF NOT EXISTS fotos_rascunho_executor_nome TEXT,
  ADD COLUMN IF NOT EXISTS fotos_rascunho_conferencia JSONB,
  ADD COLUMN IF NOT EXISTS fotos_rascunho_hodometro TEXT,
  ADD COLUMN IF NOT EXISTS fotos_rascunho_observacoes TEXT,
  ADD COLUMN IF NOT EXISTS fotos_rascunho_atualizado_em TIMESTAMPTZ;