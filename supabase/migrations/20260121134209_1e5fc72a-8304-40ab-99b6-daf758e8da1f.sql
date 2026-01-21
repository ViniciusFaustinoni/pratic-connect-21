-- Correção de dados: Atualizar documentos pendentes de associados ativos para 'aprovado'
UPDATE documentos 
SET status = 'aprovado'
WHERE status = 'pendente' 
  AND associado_id IN (
    SELECT id FROM associados WHERE status = 'ativo'
  );

-- Correção de dados: Atualizar contratos 'assinado' para 'ativo'
UPDATE contratos 
SET status = 'ativo',
    updated_at = now()
WHERE status = 'assinado';