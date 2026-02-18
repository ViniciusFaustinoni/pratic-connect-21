-- Restringir políticas do bucket cotacoes-docs
-- Remover políticas permissivas de UPDATE e DELETE para público
DROP POLICY IF EXISTS "cotacoes_docs_public_update" ON storage.objects;
DROP POLICY IF EXISTS "cotacoes_docs_public_delete" ON storage.objects;

-- Substituir política de INSERT pública por uma com validação de tipo de arquivo
DROP POLICY IF EXISTS "cotacoes_docs_public_insert" ON storage.objects;

CREATE POLICY "cotacoes_docs_public_insert_validated" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cotacoes-docs' AND
    -- Restringir a tipos de arquivo permitidos
    (name ~* '\.(jpg|jpeg|png|pdf|webp|heic)$')
  );

-- Permitir update e delete apenas para authenticated e service_role
CREATE POLICY "cotacoes_docs_authenticated_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'cotacoes-docs' AND
    auth.role() IN ('authenticated', 'service_role')
  );

CREATE POLICY "cotacoes_docs_authenticated_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'cotacoes-docs' AND
    auth.role() IN ('authenticated', 'service_role')
  );

-- Restringir a política pública de SELECT de associados para limitar colunas expostas
-- Criar uma view restrita para acesso público via link de contrato
CREATE OR REPLACE VIEW public.view_associados_publico 
WITH (security_invoker = true)
AS
SELECT 
  a.id,
  a.nome,
  a.status,
  a.data_adesao,
  a.data_ativacao,
  a.plano_id,
  a.cidade,
  a.uf
FROM associados a
WHERE a.id IN (
  SELECT c.associado_id FROM contratos c 
  WHERE c.link_token IS NOT NULL AND c.link_gerado_em IS NOT NULL
);

-- Adicionar política de leitura pública na view
-- (Views com security_invoker respeitam as políticas do caller)
