-- CORREÇÃO RETROATIVA: Limpar duplicação de registros
-- 1. Deletar vistorias tipo 'entrada' que têm instalação correspondente para a mesma cotação
DELETE FROM vistorias v
WHERE v.cotacao_id IS NOT NULL
  AND v.tipo = 'entrada'
  AND v.origem = 'cotacao'
  AND EXISTS (
    SELECT 1 FROM instalacoes i 
    WHERE i.cotacao_id = v.cotacao_id
    AND i.status NOT IN ('cancelada')
  );

-- 2. Limpar referências de vistoria_id em contratos para vistorias que foram deletadas
UPDATE contratos
SET vistoria_id = NULL
WHERE vistoria_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM vistorias WHERE id = contratos.vistoria_id);