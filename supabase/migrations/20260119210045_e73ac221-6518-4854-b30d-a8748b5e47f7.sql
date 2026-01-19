-- Corrigir vistorias existentes cujas instalações já estão canceladas
UPDATE vistorias v
SET status = 'cancelada'
FROM instalacoes i
WHERE (
  (i.cotacao_id IS NOT NULL AND i.cotacao_id = v.cotacao_id) 
  OR (i.contrato_id IS NOT NULL AND i.contrato_id = v.contrato_id)
)
AND i.status = 'cancelada'
AND v.status IN ('pendente', 'em_analise');