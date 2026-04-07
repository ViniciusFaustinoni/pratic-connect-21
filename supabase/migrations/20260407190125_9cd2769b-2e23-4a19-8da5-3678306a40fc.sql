
CREATE TABLE public.manutencao_tratativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES veiculos(id),
  associado_id uuid NOT NULL REFERENCES associados(id),
  rastreador_id uuid REFERENCES rastreadores(id),
  status text NOT NULL DEFAULT 'aguardando_contato'
    CHECK (status IN ('aguardando_contato','em_tratativa','agendado','visita_realizada','resolvido_sem_visita')),
  criado_por uuid REFERENCES profiles(id),
  observacoes text,
  data_agendamento timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.manutencao_tratativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tratativas"
  ON public.manutencao_tratativas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tratativas"
  ON public.manutencao_tratativas FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tratativas"
  ON public.manutencao_tratativas FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_manutencao_tratativas_veiculo ON public.manutencao_tratativas(veiculo_id);
CREATE INDEX idx_manutencao_tratativas_status ON public.manutencao_tratativas(status);
CREATE INDEX idx_manutencao_tratativas_created ON public.manutencao_tratativas(created_at);
