-- =====================================================
-- Migration: Permitir usuários anônimos criarem vistorias via link
-- =====================================================

-- 1. Policy INSERT para vistorias via link público
CREATE POLICY "Public can create inspections via contract link" ON public.vistorias
  FOR INSERT
  TO anon
  WITH CHECK (
    contrato_id IN (
      SELECT id FROM public.contratos 
      WHERE link_token IS NOT NULL 
      AND link_gerado_em IS NOT NULL
    )
  );

-- 2. Policy UPDATE para contratos via link público (campos limitados)
CREATE POLICY "Public can update contract via link" ON public.contratos
  FOR UPDATE
  TO anon
  USING (
    link_token IS NOT NULL 
    AND link_gerado_em IS NOT NULL
  )
  WITH CHECK (
    link_token IS NOT NULL 
    AND link_gerado_em IS NOT NULL
  );

-- 3. Policy INSERT para contratos_historico via link público
CREATE POLICY "Public can insert contract history via link" ON public.contratos_historico
  FOR INSERT
  TO anon
  WITH CHECK (
    contrato_id IN (
      SELECT id FROM public.contratos 
      WHERE link_token IS NOT NULL 
      AND link_gerado_em IS NOT NULL
    )
  );

-- 4. Policy SELECT para vistoria_fotos via contrato
CREATE POLICY "Public can view inspection photos via contract" ON public.vistoria_fotos
  FOR SELECT
  TO anon
  USING (
    vistoria_id IN (
      SELECT v.id FROM public.vistorias v
      JOIN public.contratos c ON v.contrato_id = c.id
      WHERE c.link_token IS NOT NULL 
      AND c.link_gerado_em IS NOT NULL
    )
  );

-- 5. Policy INSERT para vistoria_fotos via contrato (para autovistoria)
CREATE POLICY "Public can insert inspection photos via contract" ON public.vistoria_fotos
  FOR INSERT
  TO anon
  WITH CHECK (
    vistoria_id IN (
      SELECT v.id FROM public.vistorias v
      JOIN public.contratos c ON v.contrato_id = c.id
      WHERE c.link_token IS NOT NULL 
      AND c.link_gerado_em IS NOT NULL
    )
  );