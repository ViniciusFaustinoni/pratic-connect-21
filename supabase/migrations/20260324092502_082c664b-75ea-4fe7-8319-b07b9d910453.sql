
-- Enum para tipo de vistoriador
CREATE TYPE public.tipo_vistoriador AS ENUM ('comum', 'prestador');

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tabela de vistoriadores prestadores (sem login)
CREATE TABLE public.vistoriadores_prestadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  email text,
  cpf_cnpj text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE TRIGGER set_updated_at_vistoriadores_prestadores
  BEFORE UPDATE ON public.vistoriadores_prestadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tabela de vínculo cidade - vistoriador
CREATE TABLE public.vistoriador_cidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade text NOT NULL,
  uf text NOT NULL CHECK (char_length(uf) = 2),
  tipo_vistoriador tipo_vistoriador NOT NULL,
  vistoriador_comum_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  vistoriador_prestador_id uuid REFERENCES public.vistoriadores_prestadores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_vistoriador_id CHECK (
    (tipo_vistoriador = 'comum' AND vistoriador_comum_id IS NOT NULL AND vistoriador_prestador_id IS NULL)
    OR
    (tipo_vistoriador = 'prestador' AND vistoriador_prestador_id IS NOT NULL AND vistoriador_comum_id IS NULL)
  )
);

-- Índices
CREATE INDEX idx_vistoriador_cidades_cidade_uf ON public.vistoriador_cidades(cidade, uf);
CREATE INDEX idx_vistoriador_cidades_comum ON public.vistoriador_cidades(vistoriador_comum_id) WHERE vistoriador_comum_id IS NOT NULL;
CREATE INDEX idx_vistoriador_cidades_prestador ON public.vistoriador_cidades(vistoriador_prestador_id) WHERE vistoriador_prestador_id IS NOT NULL;

-- RLS vistoriadores_prestadores
ALTER TABLE public.vistoriadores_prestadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_vistoriadores_prestadores" ON public.vistoriadores_prestadores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "manage_vistoriadores_prestadores" ON public.vistoriadores_prestadores
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor', 'coordenador_monitoramento'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor', 'coordenador_monitoramento'))
  );

-- RLS vistoriador_cidades
ALTER TABLE public.vistoriador_cidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_vistoriador_cidades" ON public.vistoriador_cidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "manage_vistoriador_cidades" ON public.vistoriador_cidades
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor', 'coordenador_monitoramento'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor', 'coordenador_monitoramento'))
  );

-- Função RPC de consulta de cobertura
CREATE OR REPLACE FUNCTION public.buscar_cobertura_vistoria(p_cidade text, p_uf text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH comuns AS (
    SELECT vc.vistoriador_comum_id AS id, p.nome, p.telefone
    FROM vistoriador_cidades vc
    JOIN profiles p ON p.id = vc.vistoriador_comum_id
    WHERE vc.cidade = p_cidade AND vc.uf = p_uf AND vc.tipo_vistoriador = 'comum'
  ),
  prestadores AS (
    SELECT vp.id, vp.nome, vp.telefone
    FROM vistoriador_cidades vc
    JOIN vistoriadores_prestadores vp ON vp.id = vc.vistoriador_prestador_id
    WHERE vc.cidade = p_cidade AND vc.uf = p_uf AND vc.tipo_vistoriador = 'prestador' AND vp.ativo = true
  )
  SELECT jsonb_build_object(
    'tem_comum', (SELECT count(*) > 0 FROM comuns),
    'comuns', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'telefone', telefone)) FROM comuns), '[]'::jsonb),
    'tem_prestador', (SELECT count(*) > 0 FROM prestadores),
    'prestadores', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'telefone', telefone)) FROM prestadores), '[]'::jsonb),
    'fora_de_cobertura', (SELECT count(*) = 0 FROM comuns) AND (SELECT count(*) = 0 FROM prestadores)
  );
$$;
