
-- 1) Resumo do atendimento no contato
ALTER TABLE public.agente_ia_contatos
  ADD COLUMN IF NOT EXISTS resumo_atendimento text,
  ADD COLUMN IF NOT EXISTS resumo_atualizado_em timestamptz;

-- 2) Eventos importantes por contato (telefone normalizado)
CREATE TABLE IF NOT EXISTS public.contato_eventos_importantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL,
  tipo text NOT NULL,
  descricao text NOT NULL,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por text NOT NULL DEFAULT 'ia',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_contato_eventos_telefone_ocorrido
  ON public.contato_eventos_importantes (telefone, ocorrido_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contato_eventos_importantes TO authenticated;
GRANT ALL ON public.contato_eventos_importantes TO service_role;

ALTER TABLE public.contato_eventos_importantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados gerenciam eventos importantes" ON public.contato_eventos_importantes;
CREATE POLICY "Usuarios autenticados gerenciam eventos importantes"
  ON public.contato_eventos_importantes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
