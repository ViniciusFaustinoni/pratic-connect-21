-- =====================================================
-- Migration: Adicionar SELECT para vistorias via link público
-- =====================================================

-- Policy SELECT para vistorias via contrato (para retorno do .select() após insert)
CREATE POLICY "Public can view inspections via contract link" ON public.vistorias
  FOR SELECT
  TO anon
  USING (
    contrato_id IN (
      SELECT id FROM public.contratos 
      WHERE link_token IS NOT NULL 
      AND link_gerado_em IS NOT NULL
    )
  );