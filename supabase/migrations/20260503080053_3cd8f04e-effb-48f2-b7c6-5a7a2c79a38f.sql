
-- 1. Ordens servico itens: cobertura + aprovação complementar
ALTER TABLE public.ordens_servico_itens
  ADD COLUMN IF NOT EXISTS cobertura_id uuid REFERENCES public.coberturas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS complementar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_aprovacao text NOT NULL DEFAULT 'aprovado'
    CHECK (status_aprovacao IN ('pendente','aprovado','rejeitado')),
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS descoberto_em timestamptz,
  ADD COLUMN IF NOT EXISTS observacao text;

CREATE INDEX IF NOT EXISTS idx_osi_status_aprovacao
  ON public.ordens_servico_itens(status_aprovacao)
  WHERE complementar = true;
CREATE INDEX IF NOT EXISTS idx_osi_cobertura ON public.ordens_servico_itens(cobertura_id);

-- 2. Evento cotacoes pecas + contas a pagar: cobertura
ALTER TABLE public.evento_cotacoes_pecas
  ADD COLUMN IF NOT EXISTS cobertura_id uuid REFERENCES public.coberturas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ecp_cobertura ON public.evento_cotacoes_pecas(cobertura_id);

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS cobertura_id uuid REFERENCES public.coberturas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sinistro_id uuid REFERENCES public.sinistros(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cp_cobertura ON public.contas_pagar(cobertura_id);
CREATE INDEX IF NOT EXISTS idx_cp_sinistro ON public.contas_pagar(sinistro_id);

-- 3. Backfill: tipo_sinistro → codigo cobertura
DO $$
DECLARE
  v_map jsonb := '{
    "colisao":"COB-COL","roubo":"COB-RF","furto":"COB-FUR","incendio":"COB-INC",
    "fenomeno_natural":"COB-FN","vidros":"COB-VID","vandalismo":"COB-VAN","terceiros":"COB-TER"
  }'::jsonb;
BEGIN
  -- ordens_servico_itens
  UPDATE public.ordens_servico_itens osi
  SET cobertura_id = c.id
  FROM public.ordens_servico os
  JOIN public.sinistros s ON s.id = os.sinistro_id
  JOIN public.coberturas c
    ON c.codigo = (v_map ->> s.tipo::text)
  WHERE osi.cobertura_id IS NULL
    AND osi.ordem_servico_id = os.id
    AND v_map ? s.tipo::text;

  -- evento_cotacoes_pecas
  UPDATE public.evento_cotacoes_pecas ecp
  SET cobertura_id = c.id
  FROM public.sinistros s
  JOIN public.coberturas c
    ON c.codigo = (v_map ->> s.tipo::text)
  WHERE ecp.cobertura_id IS NULL
    AND ecp.sinistro_id = s.id
    AND v_map ? s.tipo::text;
END $$;

-- 4. View: custo total do evento por cobertura
CREATE OR REPLACE VIEW public.vw_custo_evento_por_cobertura AS
WITH osi AS (
  SELECT os.sinistro_id,
         osi.cobertura_id,
         SUM(COALESCE(osi.valor_total,0)) AS valor
  FROM public.ordens_servico_itens osi
  JOIN public.ordens_servico os ON os.id = osi.ordem_servico_id
  WHERE os.sinistro_id IS NOT NULL
    AND osi.status_aprovacao = 'aprovado'
  GROUP BY os.sinistro_id, osi.cobertura_id
),
cot AS (
  SELECT ecp.sinistro_id,
         ecp.cobertura_id,
         SUM(COALESCE(ecp.valor_total,0)) AS valor
  FROM public.evento_cotacoes_pecas ecp
  WHERE ecp.aprovada = true
  GROUP BY ecp.sinistro_id, ecp.cobertura_id
),
cp AS (
  SELECT cp.sinistro_id,
         cp.cobertura_id,
         SUM(COALESCE(cp.valor,0)) AS valor
  FROM public.contas_pagar cp
  WHERE cp.sinistro_id IS NOT NULL
  GROUP BY cp.sinistro_id, cp.cobertura_id
)
SELECT s.id AS sinistro_id,
       s.protocolo,
       cob.id AS cobertura_id,
       cob.codigo AS cobertura_codigo,
       cob.nome AS cobertura_nome,
       COALESCE((SELECT valor FROM osi WHERE osi.sinistro_id=s.id AND osi.cobertura_id IS NOT DISTINCT FROM cob.id),0) AS valor_pecas_os,
       COALESCE((SELECT valor FROM cot WHERE cot.sinistro_id=s.id AND cot.cobertura_id IS NOT DISTINCT FROM cob.id),0) AS valor_cotacoes_aprovadas,
       COALESCE((SELECT valor FROM cp  WHERE cp.sinistro_id=s.id  AND cp.cobertura_id  IS NOT DISTINCT FROM cob.id),0) AS valor_contas_pagar,
       (
         COALESCE((SELECT valor FROM osi WHERE osi.sinistro_id=s.id AND osi.cobertura_id IS NOT DISTINCT FROM cob.id),0) +
         COALESCE((SELECT valor FROM cot WHERE cot.sinistro_id=s.id AND cot.cobertura_id IS NOT DISTINCT FROM cob.id),0) +
         COALESCE((SELECT valor FROM cp  WHERE cp.sinistro_id=s.id  AND cp.cobertura_id  IS NOT DISTINCT FROM cob.id),0)
       ) AS valor_total
FROM public.sinistros s
LEFT JOIN LATERAL (
  SELECT DISTINCT cobertura_id FROM osi WHERE osi.sinistro_id = s.id
  UNION
  SELECT DISTINCT cobertura_id FROM cot WHERE cot.sinistro_id = s.id
  UNION
  SELECT DISTINCT cobertura_id FROM cp  WHERE cp.sinistro_id  = s.id
) src ON true
LEFT JOIN public.coberturas cob ON cob.id = src.cobertura_id;

GRANT SELECT ON public.vw_custo_evento_por_cobertura TO authenticated;
