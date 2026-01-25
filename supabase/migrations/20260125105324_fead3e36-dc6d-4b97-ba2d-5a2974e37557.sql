-- Atualizar associados que estão em 'em_analise' mas não têm vistoria/instalação concluída
UPDATE associados a
SET status = 'pendente_vistoria',
    updated_at = now()
WHERE a.status = 'em_analise'
  AND a.contrato_id IS NOT NULL
  AND NOT EXISTS (
    -- Não tem instalação concluída
    SELECT 1 FROM instalacoes i 
    WHERE i.associado_id = a.id 
    AND i.status = 'concluida'
  )
  AND NOT EXISTS (
    -- Não tem vistoria concluída/aprovada
    SELECT 1 FROM vistorias v 
    WHERE v.associado_id = a.id 
    AND v.status IN ('concluida', 'aprovada')
  )
  AND NOT EXISTS (
    -- Não tem fotos de autovistoria (via contrato)
    SELECT 1 FROM contratos ct
    JOIN cotacoes c ON c.id = ct.cotacao_id
    JOIN cotacoes_vistoria_fotos cvf ON cvf.cotacao_id = c.id
    WHERE ct.id = a.contrato_id
  );