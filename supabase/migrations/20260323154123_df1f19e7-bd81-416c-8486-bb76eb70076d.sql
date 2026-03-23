
CREATE TABLE public.municipios_atendimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  uf text NOT NULL DEFAULT 'RJ',
  tipo_atendimento text NOT NULL CHECK (tipo_atendimento IN ('volante','viagem','prestador','fora_cobertura')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(nome, uf)
);

ALTER TABLE public.municipios_atendimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view municipios" ON public.municipios_atendimento
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert municipios" ON public.municipios_atendimento
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update municipios" ON public.municipios_atendimento
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete municipios" ON public.municipios_atendimento
  FOR DELETE TO authenticated USING (true);
