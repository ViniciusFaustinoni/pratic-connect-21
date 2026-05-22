UPDATE public.veiculos v
SET uso_aplicativo = true
FROM public.contratos c
WHERE c.veiculo_id = v.id
  AND c.uso_aplicativo = true
  AND v.uso_aplicativo IS DISTINCT FROM true;