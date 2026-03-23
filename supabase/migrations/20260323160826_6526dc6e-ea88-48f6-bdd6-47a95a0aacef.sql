
-- Tabela de links tokenizados para prestadores
CREATE TABLE public.instalacao_prestador_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instalacao_id uuid NOT NULL REFERENCES public.instalacoes(id) ON DELETE CASCADE,
  prestador_id uuid NOT NULL REFERENCES public.prestadores_assistencia(id),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','em_execucao','concluida','expirado')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  chegada_em timestamptz,
  concluida_em timestamptz,
  foto_comprovante_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.instalacao_prestador_links ENABLE ROW LEVEL SECURITY;

-- Anon pode ler por token (pagina publica)
CREATE POLICY "anon_select_by_token" ON public.instalacao_prestador_links
  FOR SELECT TO anon
  USING (true);

-- Anon pode atualizar status (confirmar chegada / conclusao)
CREATE POLICY "anon_update_by_token" ON public.instalacao_prestador_links
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Authenticated pode tudo
CREATE POLICY "authenticated_all" ON public.instalacao_prestador_links
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Bucket para fotos de comprovante do prestador
INSERT INTO storage.buckets (id, name, public)
VALUES ('prestador-fotos', 'prestador-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Anon pode fazer upload (prestador via link publico)
CREATE POLICY "anon_insert_prestador_fotos" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'prestador-fotos');

-- Publico pode ler
CREATE POLICY "public_read_prestador_fotos" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'prestador-fotos');

-- Authenticated pode tudo no bucket
CREATE POLICY "authenticated_all_prestador_fotos" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'prestador-fotos')
  WITH CHECK (bucket_id = 'prestador-fotos');
