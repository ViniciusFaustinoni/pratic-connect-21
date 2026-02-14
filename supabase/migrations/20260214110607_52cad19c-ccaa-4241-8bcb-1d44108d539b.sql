
-- Tabela para registrar cotações de peças enviadas a auto centers
CREATE TABLE public.evento_cotacoes_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid REFERENCES public.sinistros(id) NOT NULL,
  auto_center_id uuid REFERENCES public.auto_centers(id) NOT NULL,
  itens jsonb NOT NULL DEFAULT '[]',
  mensagem_enviada text,
  status varchar DEFAULT 'enviado',
  whatsapp_mensagem_id uuid REFERENCES public.whatsapp_mensagens(id),
  prazo_resposta timestamp with time zone,
  resposta jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.evento_cotacoes_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cotacoes" ON public.evento_cotacoes_pecas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert cotacoes" ON public.evento_cotacoes_pecas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update cotacoes" ON public.evento_cotacoes_pecas
  FOR UPDATE TO authenticated USING (true);

-- Tabela de relacionamento sinistro-prestadores
CREATE TABLE public.sinistro_prestadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid REFERENCES public.sinistros(id) NOT NULL,
  prestador_id uuid REFERENCES public.prestadores_evento(id) NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sinistro_prestadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sinistro_prestadores" ON public.sinistro_prestadores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sinistro_prestadores" ON public.sinistro_prestadores
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sinistro_prestadores" ON public.sinistro_prestadores
  FOR DELETE TO authenticated USING (true);
