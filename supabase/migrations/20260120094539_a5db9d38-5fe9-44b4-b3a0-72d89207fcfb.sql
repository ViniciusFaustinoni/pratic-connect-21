-- Backfill: Aprovar documentação de associados já aprovados
-- Quando o contrato está 'ativo' e tem aprovado_por/aprovado_em, a documentação deve estar aprovada
-- Nota: Não setamos analista_id pois referencia auth.users e pode não existir

-- 1. Atualizar documentos do associado (tabela 'documentos')
UPDATE documentos d
SET 
  status = 'aprovado',
  data_analise = c.aprovado_em,
  motivo_reprovacao = NULL
FROM contratos c
WHERE d.associado_id = c.associado_id
  AND c.status = 'ativo'
  AND c.aprovado_por IS NOT NULL
  AND d.status IN ('pendente', 'em_analise');

-- 2. Atualizar documentos solicitados enviados
UPDATE documentos_solicitados ds
SET 
  status = 'aprovado',
  updated_at = c.aprovado_em
FROM contratos c
WHERE ds.associado_id = c.associado_id
  AND c.status = 'ativo'
  AND c.aprovado_por IS NOT NULL
  AND ds.status = 'enviado';

-- 3. Atualizar anexos da cotação (contratos_documentos)
UPDATE contratos_documentos cd
SET 
  status = 'aprovado',
  updated_at = c.aprovado_em
FROM contratos c
WHERE cd.cotacao_id = c.cotacao_id
  AND c.status = 'ativo'
  AND c.aprovado_por IS NOT NULL
  AND cd.status = 'pendente';