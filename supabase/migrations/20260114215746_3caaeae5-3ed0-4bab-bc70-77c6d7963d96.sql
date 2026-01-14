-- Corrigir autovistorias com fotos que estão pendentes para em_analise
UPDATE vistorias v
SET status = 'em_analise', updated_at = now()
WHERE modalidade = 'autovistoria' 
AND status = 'pendente'
AND EXISTS (
  SELECT 1 FROM vistoria_fotos vf 
  WHERE vf.vistoria_id = v.id
);