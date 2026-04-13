
CREATE TABLE public.edge_functions_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  function_name text NOT NULL,
  plataforma text NOT NULL,
  operacao text NOT NULL,
  status text NOT NULL DEFAULT 'sucesso',
  erro_mensagem text,
  tempo_resposta_ms integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_id uuid
);

ALTER TABLE public.edge_functions_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretores podem ver logs" ON public.edge_functions_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'));

CREATE POLICY "Service role pode inserir logs" ON public.edge_functions_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE INDEX idx_ef_logs_created ON public.edge_functions_logs(created_at DESC);
CREATE INDEX idx_ef_logs_plataforma ON public.edge_functions_logs(plataforma);
