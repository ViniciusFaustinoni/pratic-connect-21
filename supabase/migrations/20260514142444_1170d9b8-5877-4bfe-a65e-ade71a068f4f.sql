
UPDATE public.cobrancas
SET valor_pago = valor_pago / 100.0
WHERE status = 'pago'
  AND valor_pago > valor_final
  AND valor_final > 0
  AND round(valor_pago::numeric, 2) = round((valor_final * 100)::numeric, 2);
