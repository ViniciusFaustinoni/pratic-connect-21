
-- Função security definer para verificar se o usuário logado é sindicante de um determinado sinistro
CREATE OR REPLACE FUNCTION public.is_sindicante_of_sinistro(_sinistro_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sindicancias s
    JOIN empresas_sindicancia e ON e.id = s.empresa_sindicancia_id
    WHERE s.sinistro_id = _sinistro_id
      AND e.profile_id = auth.uid()
      AND s.status NOT IN ('cancelado')
  )
$$;

-- Sindicante pode ver sinistros vinculados às suas sindicâncias
CREATE POLICY "Sindicante pode ver sinistros vinculados"
ON public.sinistros
FOR SELECT
TO authenticated
USING (public.is_sindicante_of_sinistro(id));

-- Sindicante pode ver fotos de sinistros vinculados
CREATE POLICY "Sindicante pode ver fotos de sinistros vinculados"
ON public.sinistro_fotos
FOR SELECT
TO authenticated
USING (public.is_sindicante_of_sinistro(sinistro_id));

-- Sindicante pode ver documentos de sinistros vinculados
CREATE POLICY "Sindicante pode ver documentos de sinistros vinculados"
ON public.sinistro_documentos
FOR SELECT
TO authenticated
USING (public.is_sindicante_of_sinistro(sinistro_id));

-- Sindicante pode ver vistorias de sinistros vinculados
CREATE POLICY "Sindicante pode ver vistorias de sinistros vinculados"
ON public.vistorias_evento
FOR SELECT
TO authenticated
USING (public.is_sindicante_of_sinistro(sinistro_id));

-- Sindicante pode ver evento links de sinistros vinculados
CREATE POLICY "Sindicante pode ver evento links de sinistros vinculados"
ON public.sinistro_evento_links
FOR SELECT
TO authenticated
USING (public.is_sindicante_of_sinistro(sinistro_id));

-- Veículos: sindicante pode ver veículos dos sinistros vinculados
CREATE POLICY "Sindicante pode ver veiculos de sinistros vinculados"
ON public.veiculos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sinistros si
    WHERE si.veiculo_id = veiculos.id
      AND public.is_sindicante_of_sinistro(si.id)
  )
);

-- Associados: sindicante pode ver associados dos sinistros vinculados
CREATE POLICY "Sindicante pode ver associados de sinistros vinculados"
ON public.associados
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sinistros si
    WHERE si.associado_id = associados.id
      AND public.is_sindicante_of_sinistro(si.id)
  )
);
