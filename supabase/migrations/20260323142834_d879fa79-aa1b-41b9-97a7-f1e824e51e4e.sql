
CREATE TABLE public.registros_recusa_tarefa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id uuid NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  profissional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  turno_id uuid REFERENCES public.turnos_profissionais(id) ON DELETE SET NULL,
  motivo text NOT NULL,
  motivo_livre text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registros_recusa_tarefa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert recusas" ON public.registros_recusa_tarefa
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can select recusas" ON public.registros_recusa_tarefa
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao)
VALUES 
  ('recusa_exigir_motivo', 'true', 'booleano', 'operacional', 'Exigir motivo ao recusar tarefa'),
  ('recusa_limite_alerta', '3', 'numero', 'operacional', 'Limite de recusas por turno para gerar alerta ao coordenador')
ON CONFLICT (chave) DO NOTHING;
