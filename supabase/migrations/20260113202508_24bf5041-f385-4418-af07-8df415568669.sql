-- =====================================================
-- Migration: Acesso público a contratos via link_token
-- =====================================================

-- 1. Policy para contratos - acesso público via token
CREATE POLICY "Public access via link_token" ON public.contratos
  FOR SELECT
  TO anon
  USING (
    link_token IS NOT NULL 
    AND link_gerado_em IS NOT NULL
  );

-- 2. Policy para associados - acesso público via contrato
CREATE POLICY "Public access via contrato link" ON public.associados
  FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT associado_id FROM public.contratos 
      WHERE link_token IS NOT NULL 
      AND link_gerado_em IS NOT NULL
    )
  );

-- 3. Policy para leads - acesso público via contrato
CREATE POLICY "Public access via contrato link" ON public.leads
  FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT lead_id FROM public.contratos 
      WHERE link_token IS NOT NULL 
      AND link_gerado_em IS NOT NULL
    )
  );

-- 4. Policy para planos - acesso público de leitura
CREATE POLICY "Public can read plans" ON public.planos
  FOR SELECT
  TO anon
  USING (ativo = true);