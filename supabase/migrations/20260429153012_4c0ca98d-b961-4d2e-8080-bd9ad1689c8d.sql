-- 1) Ampliar CHECK constraint de status
ALTER TABLE public.instalacao_prestador_links
  DROP CONSTRAINT IF EXISTS instalacao_prestador_links_status_check;

ALTER TABLE public.instalacao_prestador_links
  ADD CONSTRAINT instalacao_prestador_links_status_check
  CHECK (status IN ('aguardando','em_execucao','concluida','expirado','aceito','em_rota','cancelada'));

-- 2) Colunas faltantes para auto-save
ALTER TABLE public.instalacao_prestador_links
  ADD COLUMN IF NOT EXISTS checklist_data jsonb,
  ADD COLUMN IF NOT EXISTS fotos_vistoria jsonb,
  ADD COLUMN IF NOT EXISTS assinatura_url text;

-- 3) Função SECURITY DEFINER para validar link de prestador
CREATE OR REPLACE FUNCTION public.has_valid_prestador_link(_instalacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.instalacao_prestador_links l
    WHERE l.instalacao_id = _instalacao_id
      AND (l.expires_at IS NULL OR l.expires_at > now())
      AND l.status <> 'cancelada'
  );
$$;

-- 4) Policies anon SELECT escopadas pelo link de prestador

-- instalacoes
DROP POLICY IF EXISTS "anon_select_instalacoes_via_prestador_link" ON public.instalacoes;
CREATE POLICY "anon_select_instalacoes_via_prestador_link"
  ON public.instalacoes
  FOR SELECT
  TO anon
  USING (public.has_valid_prestador_link(id));

-- associados
DROP POLICY IF EXISTS "anon_select_associados_via_prestador_link" ON public.associados;
CREATE POLICY "anon_select_associados_via_prestador_link"
  ON public.associados
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.instalacoes i
      WHERE i.associado_id = associados.id
        AND public.has_valid_prestador_link(i.id)
    )
  );

-- veiculos
DROP POLICY IF EXISTS "anon_select_veiculos_via_prestador_link" ON public.veiculos;
CREATE POLICY "anon_select_veiculos_via_prestador_link"
  ON public.veiculos
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.instalacoes i
      WHERE i.veiculo_id = veiculos.id
        AND public.has_valid_prestador_link(i.id)
    )
  );

-- rastreadores
DROP POLICY IF EXISTS "anon_select_rastreadores_via_prestador_link" ON public.rastreadores;
CREATE POLICY "anon_select_rastreadores_via_prestador_link"
  ON public.rastreadores
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.instalacoes i
      WHERE i.rastreador_id = rastreadores.id
        AND public.has_valid_prestador_link(i.id)
    )
  );