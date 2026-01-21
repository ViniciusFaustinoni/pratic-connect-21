-- Corrigir contratos existentes que têm veiculo_id null mas o associado tem veículo
UPDATE contratos c
SET veiculo_id = (
  SELECT v.id 
  FROM veiculos v 
  WHERE v.associado_id = c.associado_id 
  ORDER BY v.created_at DESC
  LIMIT 1
)
WHERE c.veiculo_id IS NULL
  AND c.associado_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM veiculos v WHERE v.associado_id = c.associado_id
  );