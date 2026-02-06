-- ============================================
-- POLÍTICAS RLS PARA ACESSO PÚBLICO VIA LINK_TOKEN
-- Permite que a página de acompanhamento público (/acompanhar/:token)
-- leia os dados do veículo e instalações do associado
-- ============================================

-- 1. Política para veículos - anon pode ler veículos de associados com contrato público
CREATE POLICY "Public access via contrato link for veiculos"
ON public.veiculos
FOR SELECT
TO anon
USING (
  associado_id IN (
    SELECT contratos.associado_id
    FROM contratos
    WHERE contratos.link_token IS NOT NULL
      AND contratos.link_gerado_em IS NOT NULL
      AND contratos.associado_id IS NOT NULL
  )
);

-- 2. Política para instalações - anon pode ler instalações de associados com contrato público  
CREATE POLICY "Public access via contrato link for instalacoes"
ON public.instalacoes
FOR SELECT
TO anon
USING (
  associado_id IN (
    SELECT contratos.associado_id
    FROM contratos
    WHERE contratos.link_token IS NOT NULL
      AND contratos.link_gerado_em IS NOT NULL
      AND contratos.associado_id IS NOT NULL
  )
);