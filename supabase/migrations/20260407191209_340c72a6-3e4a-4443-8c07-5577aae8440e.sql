
-- Tabela de logs de tratativa
CREATE TABLE public.manutencao_tratativa_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tratativa_id uuid NOT NULL REFERENCES public.manutencao_tratativas(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  acao text NOT NULL,
  dados jsonb DEFAULT '{}',
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.manutencao_tratativa_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tratativa logs"
  ON public.manutencao_tratativa_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tratativa logs"
  ON public.manutencao_tratativa_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Adicionar coluna etapa_atual na tabela existente
ALTER TABLE public.manutencao_tratativas
  ADD COLUMN IF NOT EXISTS etapa_atual text NOT NULL DEFAULT 'contato';
