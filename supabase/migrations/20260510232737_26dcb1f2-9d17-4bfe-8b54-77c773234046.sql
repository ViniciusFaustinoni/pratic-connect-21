UPDATE public.cotacoes
SET valor_total_mensal = 382.20,
    valor_cota = 382.20
WHERE id = '6f29fc8c-7933-4f71-9d8a-98d35863380c'
  AND (valor_total_mensal IS NULL OR valor_total_mensal = 0);