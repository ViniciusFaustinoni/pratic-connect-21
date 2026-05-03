-- Fase 4.5: vw_custo_evento_por_cobertura considera cobertura herdada via peca_pai_id
CREATE OR REPLACE VIEW public.vw_custo_evento_por_cobertura AS
WITH osi AS (
  SELECT
    os.sinistro_id,
    COALESCE(osi.cobertura_id, pai.cobertura_id) AS cobertura_id,
    SUM(COALESCE(osi.valor_total, 0::numeric)) AS valor
  FROM ordens_servico_itens osi
  JOIN ordens_servico os ON os.id = osi.ordem_servico_id
  LEFT JOIN ordens_servico_itens pai ON pai.id = osi.peca_pai_id
  WHERE os.sinistro_id IS NOT NULL
    AND osi.status_aprovacao = 'aprovado'::text
  GROUP BY os.sinistro_id, COALESCE(osi.cobertura_id, pai.cobertura_id)
), cot AS (
  SELECT ecp.sinistro_id, ecp.cobertura_id,
         SUM(COALESCE(ecp.valor_total, 0::numeric)) AS valor
  FROM evento_cotacoes_pecas ecp
  WHERE ecp.aprovada = true
  GROUP BY ecp.sinistro_id, ecp.cobertura_id
), cp AS (
  SELECT cp.sinistro_id, cp.cobertura_id,
         SUM(COALESCE(cp.valor, 0::numeric)) AS valor
  FROM contas_pagar cp
  WHERE cp.sinistro_id IS NOT NULL
  GROUP BY cp.sinistro_id, cp.cobertura_id
)
SELECT
  s.id AS sinistro_id,
  s.protocolo,
  cob.id AS cobertura_id,
  cob.codigo AS cobertura_codigo,
  cob.nome AS cobertura_nome,
  COALESCE((SELECT osi.valor FROM osi WHERE osi.sinistro_id = s.id AND osi.cobertura_id IS NOT DISTINCT FROM cob.id), 0::numeric) AS valor_pecas_os,
  COALESCE((SELECT cot.valor FROM cot WHERE cot.sinistro_id = s.id AND cot.cobertura_id IS NOT DISTINCT FROM cob.id), 0::numeric) AS valor_cotacoes_aprovadas,
  COALESCE((SELECT cp.valor  FROM cp  WHERE cp.sinistro_id  = s.id AND cp.cobertura_id  IS NOT DISTINCT FROM cob.id), 0::numeric) AS valor_contas_pagar,
  COALESCE((SELECT osi.valor FROM osi WHERE osi.sinistro_id = s.id AND osi.cobertura_id IS NOT DISTINCT FROM cob.id), 0::numeric)
  + COALESCE((SELECT cot.valor FROM cot WHERE cot.sinistro_id = s.id AND cot.cobertura_id IS NOT DISTINCT FROM cob.id), 0::numeric)
  + COALESCE((SELECT cp.valor  FROM cp  WHERE cp.sinistro_id  = s.id AND cp.cobertura_id  IS NOT DISTINCT FROM cob.id), 0::numeric) AS valor_total
FROM sinistros s
LEFT JOIN LATERAL (
  SELECT DISTINCT osi.cobertura_id FROM osi WHERE osi.sinistro_id = s.id
  UNION
  SELECT DISTINCT cot.cobertura_id FROM cot WHERE cot.sinistro_id = s.id
  UNION
  SELECT DISTINCT cp.cobertura_id  FROM cp  WHERE cp.sinistro_id  = s.id
) src ON true
LEFT JOIN coberturas cob ON cob.id = src.cobertura_id;