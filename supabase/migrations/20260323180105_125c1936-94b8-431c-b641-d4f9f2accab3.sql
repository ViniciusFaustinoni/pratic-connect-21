
-- 1. Create new table for installation partners
CREATE TABLE public.prestadores_instalacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  whatsapp text,
  municipios_atuacao text[] DEFAULT '{}',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.prestadores_instalacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON public.prestadores_instalacao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Migrate FK on instalacao_prestador_links
ALTER TABLE public.instalacao_prestador_links
  DROP CONSTRAINT IF EXISTS instalacao_prestador_links_prestador_id_fkey;

ALTER TABLE public.instalacao_prestador_links
  ADD CONSTRAINT instalacao_prestador_links_prestador_id_fkey
    FOREIGN KEY (prestador_id) REFERENCES public.prestadores_instalacao(id);
