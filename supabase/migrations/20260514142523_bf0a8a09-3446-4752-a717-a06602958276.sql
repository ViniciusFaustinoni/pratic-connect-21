
WITH unico AS (
  SELECT associado_id, (array_agg(id))[1] AS veic_id
  FROM public.veiculos
  WHERE associado_id IN (
    SELECT associado_id FROM public.cobranca_csv_boletos
    WHERE veiculo_id IS NULL AND associado_id IS NOT NULL
  )
  GROUP BY associado_id
  HAVING count(*) = 1
)
UPDATE public.cobranca_csv_boletos csv
SET veiculo_id = u.veic_id
FROM unico u
WHERE csv.veiculo_id IS NULL
  AND csv.associado_id = u.associado_id;
