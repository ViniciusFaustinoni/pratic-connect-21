
CREATE TABLE public.sga_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  veiculo_id uuid REFERENCES veiculos(id) ON DELETE CASCADE NOT NULL,
  associado_id uuid REFERENCES associados(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente','processando','concluido','falha_permanente')),
  tentativas int DEFAULT 0,
  ultima_tentativa_em timestamptz,
  proximo_reenvio_em timestamptz DEFAULT now(),
  erro_ultimo text,
  etapa_parou text,
  codigo_associado_hinova int,
  codigo_veiculo_hinova int,
  origem text DEFAULT 'automatico',
  UNIQUE(veiculo_id, associado_id)
);

ALTER TABLE public.sga_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sync queue"
ON public.sga_sync_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
