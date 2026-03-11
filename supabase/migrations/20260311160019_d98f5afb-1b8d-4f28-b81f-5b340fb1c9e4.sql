ALTER TABLE public.contratos 
  ADD COLUMN IF NOT EXISTS cota_participacao numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cota_minima numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cobertura_fipe numeric DEFAULT NULL;

COMMENT ON COLUMN public.contratos.cota_participacao IS 'Percentual da cota de participação contextual (pode diferir do plano base para uso app)';
COMMENT ON COLUMN public.contratos.cota_minima IS 'Valor mínimo da cota de participação contextual';
COMMENT ON COLUMN public.contratos.cobertura_fipe IS 'Percentual de cobertura FIPE do plano no momento da contratação';