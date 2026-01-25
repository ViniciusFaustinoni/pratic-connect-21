-- Corrigir documentos que foram aprovados prematuramente pelo OCR
-- Resetar para 'pendente' em contratos que ainda não estão ativos

UPDATE contratos_documentos cd
SET 
  status = 'pendente',
  updated_at = NOW()
FROM contratos c
WHERE cd.contrato_id = c.id
  AND c.status != 'ativo'
  AND cd.status = 'aprovado';

-- Também resetar via cotacao_id para documentos vinculados por cotação
UPDATE contratos_documentos cd
SET 
  status = 'pendente',
  updated_at = NOW()
FROM contratos c
WHERE cd.cotacao_id = c.cotacao_id
  AND c.status != 'ativo'
  AND cd.status = 'aprovado';