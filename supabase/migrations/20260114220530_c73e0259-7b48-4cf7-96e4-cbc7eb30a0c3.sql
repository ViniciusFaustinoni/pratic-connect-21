-- Corrigir associados que têm contrato ativo mas estão com status incorreto
UPDATE associados a
SET 
  status = 'ativo',
  data_adesao = COALESCE(c.data_ativacao::date, CURRENT_DATE),
  updated_at = now()
FROM contratos c
WHERE c.associado_id = a.id
  AND c.status = 'ativo'
  AND a.status IN ('em_analise', 'aprovado', 'documentacao_pendente', 'aguardando_instalacao');