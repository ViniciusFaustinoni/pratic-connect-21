
-- Tabela para links tokenizados de vistoria por prestador
CREATE TABLE public.vistoria_prestador_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instalacao_id uuid NOT NULL REFERENCES public.instalacoes(id) ON DELETE CASCADE,
  vistoriador_prestador_id uuid NOT NULL REFERENCES public.vistoriadores_prestadores(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','em_execucao','concluida','cancelada')),
  valor numeric(10,2),
  chegada_em timestamptz,
  concluida_em timestamptz,
  foto_comprovante_url text,
  whatsapp_enviado boolean DEFAULT false,
  whatsapp_erro text,
  atribuido_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for token lookups
CREATE INDEX idx_vistoria_prestador_links_token ON public.vistoria_prestador_links(token);
CREATE INDEX idx_vistoria_prestador_links_instalacao ON public.vistoria_prestador_links(instalacao_id);

-- RLS
ALTER TABLE public.vistoria_prestador_links ENABLE ROW LEVEL SECURITY;

-- Public SELECT (for token-based access without login)
CREATE POLICY "Public read by token" ON public.vistoria_prestador_links
  FOR SELECT TO anon, authenticated
  USING (true);

-- Authenticated users can insert/update
CREATE POLICY "Authenticated can insert" ON public.vistoria_prestador_links
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update" ON public.vistoria_prestador_links
  FOR UPDATE TO authenticated
  USING (true);

-- Anon can update (for public page status changes)
CREATE POLICY "Anon can update status" ON public.vistoria_prestador_links
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
