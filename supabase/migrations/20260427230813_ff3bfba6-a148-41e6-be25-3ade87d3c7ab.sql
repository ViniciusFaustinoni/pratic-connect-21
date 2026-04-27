ALTER TABLE public.instalacoes
  ADD COLUMN IF NOT EXISTS dispensa_rastreador boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.instalacoes.dispensa_rastreador IS
  'Quando true, a instalação refere-se a um veículo que dispensa rastreador (FIPE abaixo do limite e não-Diesel). Vistoria pública conclui só com fotos+vídeo, sem visita técnica.';

CREATE INDEX IF NOT EXISTS idx_instalacoes_dispensa_rastreador
  ON public.instalacoes (dispensa_rastreador)
  WHERE dispensa_rastreador = true;

WITH config AS (
  SELECT
    COALESCE((SELECT (valor)::numeric FROM public.configuracoes WHERE chave = 'operacional_fipe_minimo_rastreador'      LIMIT 1), 30000) AS fipe_carro,
    COALESCE((SELECT (valor)::numeric FROM public.configuracoes WHERE chave = 'operacional_fipe_minimo_rastreador_moto' LIMIT 1), 9000)  AS fipe_moto
)
UPDATE public.instalacoes i
SET dispensa_rastreador = true
FROM public.veiculos v
LEFT JOIN public.marcas_modelos mm ON mm.modelo = v.modelo AND mm.marca = v.marca
CROSS JOIN config c
WHERE i.veiculo_id = v.id
  AND COALESCE(LOWER(v.combustivel), '') <> 'diesel'
  AND (
    (LOWER(COALESCE(mm.tipo_veiculo, '')) = 'moto'  AND COALESCE(v.valor_fipe, 0) < c.fipe_moto) OR
    (LOWER(COALESCE(mm.tipo_veiculo, '')) <> 'moto' AND COALESCE(v.valor_fipe, 0) < c.fipe_carro)
  );