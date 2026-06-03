ALTER TABLE public.agente_ia_contatos
  ADD COLUMN IF NOT EXISTS sga_associado_status text,
  ADD COLUMN IF NOT EXISTS sga_associado_id uuid,
  ADD COLUMN IF NOT EXISTS ultima_saudacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS nome_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberacao_enviada_em timestamptz;