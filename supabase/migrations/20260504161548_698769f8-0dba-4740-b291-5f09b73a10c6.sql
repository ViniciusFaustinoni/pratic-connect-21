UPDATE public.veiculos v
SET numero_motor = upper(trim(c.veiculo_motor))
FROM public.cotacoes c
WHERE v.numero_motor IS NULL
  AND c.veiculo_motor IS NOT NULL
  AND trim(c.veiculo_motor) <> ''
  AND lower(trim(c.veiculo_motor)) <> 'ilegivel'
  AND (
    (v.placa = c.veiculo_placa AND v.placa NOT ILIKE '0KM%')
    OR (v.chassi IS NOT NULL AND v.chassi = c.veiculo_chassi)
  );