
ALTER TABLE public.veiculos  ADD COLUMN IF NOT EXISTS cambio TEXT;
ALTER TABLE public.cotacoes  ADD COLUMN IF NOT EXISTS veiculo_cambio TEXT;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS veiculo_cambio TEXT;

-- Backfill best-effort para veículos cujo nome do modelo já indica o câmbio
UPDATE public.veiculos
SET cambio = 'automatico'
WHERE cambio IS NULL
  AND modelo IS NOT NULL
  AND upper(modelo) ~ '\b(AUTOMATICO|AUTOMÁTICO|CVT|AUT|TIPTRONIC|POWERSHIFT|DSG|S-?TRONIC|I-?MOTION|MULTITRONIC|STEPTRONIC|E-?CVT|DIRECT-?SHIFT|PDK|EDC|XTRONIC|LINEARTRONIC|SKYACTIV-?DRIVE|EASYTRONIC|DCT|MULTIDRIVE|DUALOGIC|AUTOMATIZAD)\b';

UPDATE public.veiculos
SET cambio = 'manual'
WHERE cambio IS NULL
  AND modelo IS NOT NULL
  AND upper(modelo) ~ '\b(MANUAL|MECANICO|MECÂNICO|MT|MEC)\b';
