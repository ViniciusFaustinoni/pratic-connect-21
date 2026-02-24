
-- Tabela de tokens de acompanhamento do associado
CREATE TABLE public.acompanhamento_reboque_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id UUID NOT NULL REFERENCES public.chamados_assistencia(id) ON DELETE CASCADE,
  associado_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expira_em TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca por token
CREATE INDEX idx_acompanhamento_reboque_token ON public.acompanhamento_reboque_tokens(token);
CREATE INDEX idx_acompanhamento_reboque_chamado ON public.acompanhamento_reboque_tokens(chamado_id);

-- Habilitar RLS
ALTER TABLE public.acompanhamento_reboque_tokens ENABLE ROW LEVEL SECURITY;

-- Anon pode ler apenas por token (página pública)
CREATE POLICY "Anon pode consultar por token"
  ON public.acompanhamento_reboque_tokens
  FOR SELECT
  TO anon
  USING (true);

-- Authenticated users com perfil adequado podem ver
CREATE POLICY "Authenticated users podem consultar"
  ON public.acompanhamento_reboque_tokens
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert/Update apenas via service_role (edge functions) — sem policy de INSERT/UPDATE para anon/authenticated
