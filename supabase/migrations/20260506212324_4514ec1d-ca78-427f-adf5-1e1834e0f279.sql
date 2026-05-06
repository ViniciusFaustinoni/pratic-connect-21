-- Backfill: zerar numero_portas em cotações de moto contaminadas pelo bug
UPDATE public.cotacoes
SET numero_portas = 0
WHERE LOWER(COALESCE(veiculo_categoria, categoria, '')) ~ 'moto'
  AND numero_portas IS DISTINCT FROM 0;

-- Backfill: zerar veiculo_numero_portas em contratos de moto
UPDATE public.contratos
SET veiculo_numero_portas = 0
WHERE LOWER(COALESCE(veiculo_categoria, '')) ~ 'moto'
  AND veiculo_numero_portas IS DISTINCT FROM 0;