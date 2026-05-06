UPDATE public.cotacoes
SET cliente_numero = '383',
    cliente_complemento = COALESCE(NULLIF(cliente_complemento, ''), 'CASA 2')
WHERE id = 'c1b6fab0-dd01-4ada-bb94-d2af1fc38694'
  AND veiculo_placa = 'SSA3G29';