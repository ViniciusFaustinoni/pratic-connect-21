CREATE TABLE public.servicos_atribuicoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id uuid REFERENCES public.servicos(id) ON DELETE CASCADE NOT NULL,
  profissional_id uuid REFERENCES public.profiles(id) NOT NULL,
  tipo_atribuicao text NOT NULL DEFAULT 'automatica',
  atribuido_por uuid REFERENCES public.profiles(id),
  distancia_km numeric,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.servicos_atribuicoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view logs" ON public.servicos_atribuicoes_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert logs" ON public.servicos_atribuicoes_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_atribuicoes_log_created ON public.servicos_atribuicoes_log(created_at DESC);
CREATE INDEX idx_atribuicoes_log_servico ON public.servicos_atribuicoes_log(servico_id);