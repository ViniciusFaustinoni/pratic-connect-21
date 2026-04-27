ALTER TABLE public.vistoria_links
  ADD COLUMN IF NOT EXISTS exige_etapa_instalacao boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.vistoria_links.exige_etapa_instalacao IS
  'Quando false, o link público conclui a vistoria apenas com fotos+vídeo (veículos que dispensam rastreador: FIPE abaixo do limite e não-Diesel).';

WITH config AS (
  SELECT
    COALESCE((SELECT (valor)::numeric FROM public.configuracoes WHERE chave = 'fipe_min_rastreador_carro' LIMIT 1), 30000) AS fipe_carro,
    COALESCE((SELECT (valor)::numeric FROM public.configuracoes WHERE chave = 'fipe_min_rastreador_moto'  LIMIT 1), 9000)  AS fipe_moto
)
UPDATE public.vistoria_links vl
SET exige_etapa_instalacao = false
FROM public.instalacoes i
JOIN public.veiculos v ON v.id = i.veiculo_id
LEFT JOIN public.marcas_modelos mm ON mm.modelo = v.modelo AND mm.marca = v.marca
CROSS JOIN config c
WHERE vl.instalacao_id = i.id
  AND COALESCE(LOWER(v.combustivel), '') <> 'diesel'
  AND (
    (LOWER(COALESCE(mm.tipo_veiculo, '')) = 'moto'  AND COALESCE(v.valor_fipe, 0) <  c.fipe_moto) OR
    (LOWER(COALESCE(mm.tipo_veiculo, '')) <> 'moto' AND COALESCE(v.valor_fipe, 0) <  c.fipe_carro)
  );