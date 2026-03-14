
CREATE TABLE public.whatsapp_fila_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid REFERENCES public.whatsapp_mensagens(id),
  telefone text NOT NULL,
  texto text,
  tipo_msg text DEFAULT 'text',
  latitude double precision,
  longitude double precision,
  message_id text,
  status text DEFAULT 'pendente',
  tentativas int DEFAULT 0,
  erro text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_fila_ia_pendente ON public.whatsapp_fila_ia(status) WHERE status IN ('pendente','erro');

ALTER TABLE public.whatsapp_fila_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on whatsapp_fila_ia"
  ON public.whatsapp_fila_ia
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read whatsapp_fila_ia"
  ON public.whatsapp_fila_ia
  FOR SELECT
  TO authenticated
  USING (true);
