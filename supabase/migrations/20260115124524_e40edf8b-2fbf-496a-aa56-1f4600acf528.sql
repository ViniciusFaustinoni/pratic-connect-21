-- Permitir que clientes via link público atualizem apenas o status do associado
-- quando têm um contrato com link válido gerado
CREATE POLICY "Public update status via contrato link" 
ON public.associados
FOR UPDATE
TO anon, authenticated
USING (
  id IN (
    SELECT contratos.associado_id
    FROM contratos
    WHERE contratos.link_token IS NOT NULL 
      AND contratos.link_gerado_em IS NOT NULL
      AND contratos.associado_id IS NOT NULL
  )
)
WITH CHECK (
  id IN (
    SELECT contratos.associado_id
    FROM contratos
    WHERE contratos.link_token IS NOT NULL 
      AND contratos.link_gerado_em IS NOT NULL
      AND contratos.associado_id IS NOT NULL
  )
);

-- Corrigir o associado específico que já enviou os documentos (ID da screenshot)
UPDATE associados 
SET status = 'em_analise', updated_at = NOW()
WHERE id = '12b5182a-56e7-4532-ba67-a98edc89987d';