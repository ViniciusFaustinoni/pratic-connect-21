ALTER TABLE ordens_servico
  ADD COLUMN IF NOT EXISTS autentique_documento_id text,
  ADD COLUMN IF NOT EXISTS autentique_url text,
  ADD COLUMN IF NOT EXISTS termo_saida_assinado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS termo_saida_assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS termo_saida_url text;