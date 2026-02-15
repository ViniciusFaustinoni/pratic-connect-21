
CREATE TABLE public.pesquisas_antecedentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf_cnpj varchar NOT NULL,
  nome varchar NOT NULL,
  resultado jsonb NOT NULL DEFAULT '{}',
  score_risco varchar,
  associado_id uuid REFERENCES associados(id),
  processo_id uuid REFERENCES processos(id),
  pesquisado_por uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pesquisas_antecedentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage pesquisas_antecedentes"
  ON public.pesquisas_antecedentes
  FOR ALL
  USING (auth.uid() IS NOT NULL);
