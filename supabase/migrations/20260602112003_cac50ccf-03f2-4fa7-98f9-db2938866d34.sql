ALTER TABLE public.agente_ia_contatos
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS cpf_capturado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cpf_solicitado_em timestamptz,
  ADD COLUMN IF NOT EXISTS sga_associado_encontrado boolean;

CREATE INDEX IF NOT EXISTS idx_agente_ia_contatos_cpf
  ON public.agente_ia_contatos(cpf) WHERE cpf IS NOT NULL;