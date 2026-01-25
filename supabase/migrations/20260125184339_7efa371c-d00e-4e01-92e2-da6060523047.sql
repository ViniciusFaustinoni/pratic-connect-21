-- Adicionar 'laudo_vistoria' ao constraint de tipo da tabela contratos_documentos
ALTER TABLE contratos_documentos DROP CONSTRAINT contratos_documentos_tipo_check;

ALTER TABLE contratos_documentos ADD CONSTRAINT contratos_documentos_tipo_check 
  CHECK (tipo::text = ANY (ARRAY['crlv', 'cnh', 'rg', 'comprovante_residencia', 'laudo_vistoria']::text[]));

-- Correção retroativa: inserir laudo existente em contratos_documentos
INSERT INTO contratos_documentos (
  contrato_id,
  cotacao_id,
  tipo,
  arquivo_url,
  arquivo_nome,
  status,
  created_at
)
SELECT 
  c.id as contrato_id,
  c.cotacao_id,
  'laudo_vistoria' as tipo,
  d.arquivo_url,
  d.nome_arquivo as arquivo_nome,
  'pendente' as status,
  d.created_at
FROM documentos d
JOIN associados a ON a.id = d.associado_id
JOIN contratos c ON c.associado_id = a.id
WHERE d.tipo = 'laudo_vistoria'
  AND NOT EXISTS (
    SELECT 1 FROM contratos_documentos cd 
    WHERE cd.arquivo_url = d.arquivo_url 
    AND cd.tipo = 'laudo_vistoria'
  )
ORDER BY d.created_at DESC;