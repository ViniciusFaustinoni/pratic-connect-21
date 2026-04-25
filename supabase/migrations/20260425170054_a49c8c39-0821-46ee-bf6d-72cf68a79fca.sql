-- ============================================================
-- Tabela: vistoria_links (link público unificado de vistoria)
-- Cada instalação tem 1 link com 2 etapas independentes:
--   1) fotos & vídeo  2) instalação do rastreador
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vistoria_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instalacao_id uuid NOT NULL UNIQUE,
  vistoria_id uuid,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),

  status text NOT NULL DEFAULT 'pendente',
    -- pendente | fotos_concluidas | instalacao_concluida | concluido | cancelado

  fotos_etapa_status text NOT NULL DEFAULT 'pendente',
    -- pendente | em_andamento | concluida
  instalacao_etapa_status text NOT NULL DEFAULT 'pendente',
    -- pendente | em_andamento | concluida

  fotos_concluida_em timestamptz,
  instalacao_concluida_em timestamptz,

  fotos_executor_nome text,
  instalacao_executor_nome text,
  instalacao_executor_tipo text,
    -- 'interno' | 'prestador' | 'publico'

  tecnico_atribuido_id uuid,           -- profiles.id (técnico interno)
  prestador_atribuido_id uuid,         -- vistoriadores_prestadores.id

  iniciada_em timestamptz,             -- quando o técnico tocou "iniciar instalação"
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vistoria_links_token ON public.vistoria_links(token);
CREATE INDEX IF NOT EXISTS idx_vistoria_links_instalacao_id ON public.vistoria_links(instalacao_id);
CREATE INDEX IF NOT EXISTS idx_vistoria_links_status ON public.vistoria_links(status);

-- ============================================================
-- Trigger: atualiza updated_at e status agregado automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION public.vistoria_links_sync_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.fotos_etapa_status = 'concluida' AND NEW.instalacao_etapa_status = 'concluida' THEN
    NEW.status := 'concluido';
  ELSIF NEW.fotos_etapa_status = 'concluida' THEN
    NEW.status := 'fotos_concluidas';
  ELSIF NEW.instalacao_etapa_status = 'concluida' THEN
    NEW.status := 'instalacao_concluida';
  ELSIF NEW.status NOT IN ('cancelado') THEN
    NEW.status := 'pendente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vistoria_links_sync_status ON public.vistoria_links;
CREATE TRIGGER trg_vistoria_links_sync_status
BEFORE INSERT OR UPDATE ON public.vistoria_links
FOR EACH ROW
EXECUTE FUNCTION public.vistoria_links_sync_status();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.vistoria_links ENABLE ROW LEVEL SECURITY;

-- Leitura pública por token (o token é o segredo).
CREATE POLICY "vistoria_links_public_select"
ON public.vistoria_links
FOR SELECT
TO anon, authenticated
USING (true);

-- Atualização apenas via Edge Function (service role) — autenticados internos
-- também podem atualizar quando precisam (coordenador, técnico).
CREATE POLICY "vistoria_links_authenticated_update"
ON public.vistoria_links
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "vistoria_links_authenticated_insert"
ON public.vistoria_links
FOR INSERT
TO authenticated
WITH CHECK (true);
