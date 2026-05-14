-- Índices auxiliares para performance
CREATE INDEX IF NOT EXISTS idx_csv_boletos_data_vencimento ON public.cobranca_csv_boletos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_csv_boletos_status_origem ON public.cobranca_csv_boletos(status_origem);
CREATE INDEX IF NOT EXISTS idx_csv_boletos_associado_id ON public.cobranca_csv_boletos(associado_id);
CREATE INDEX IF NOT EXISTS idx_csv_boletos_linha_digitavel ON public.cobranca_csv_boletos(linha_digitavel);

-- View unificada
CREATE OR REPLACE VIEW public.cobrancas_unificadas
WITH (security_invoker = on) AS
-- Lado nativo (Asaas + backfill SGA)
SELECT
  c.id,
  'sistema'::text                              AS fonte,
  c.origem::text                               AS origem,
  c.associado_id,
  c.veiculo_id,
  c.contrato_id,
  COALESCE(c.tipo, 'mensalidade')::text        AS tipo,
  c.status::text                               AS status,
  c.valor_final,
  c.valor_pago,
  c.data_vencimento,
  c.data_pagamento,
  c.referencia_mes,
  c.referencia_ano,
  c.linha_digitavel::text                      AS linha_digitavel,
  c.codigo_barras::text                        AS codigo_barras,
  c.boleto_url,
  c.descricao,
  c.created_at                                 AS criado_em,
  NULL::uuid                                   AS lote_id,
  NULL::text                                   AS matricula
FROM public.cobrancas c

UNION ALL

-- Lado CSV (lotes importados via Régua)
SELECT
  b.id,
  'csv_sga'::text                              AS fonte,
  'sga_hinova'::text                           AS origem,
  b.associado_id,
  b.veiculo_id,
  NULL::uuid                                   AS contrato_id,
  COALESCE(b.tipo, 'mensalidade')::text        AS tipo,
  CASE
    WHEN b.status_origem ILIKE 'Pago%'        THEN 'pago'
    WHEN b.recuperado_em IS NOT NULL          THEN 'pago'
    WHEN b.data_vencimento IS NOT NULL
         AND b.data_vencimento < CURRENT_DATE THEN 'vencido'
    ELSE 'aguardando_pagamento'
  END                                          AS status,
  b.valor                                      AS valor_final,
  CASE WHEN b.status_origem ILIKE 'Pago%' OR b.recuperado_em IS NOT NULL
       THEN b.valor ELSE NULL END              AS valor_pago,
  b.data_vencimento,
  NULL::date                                   AS data_pagamento,
  EXTRACT(MONTH FROM b.data_vencimento)::int   AS referencia_mes,
  EXTRACT(YEAR  FROM b.data_vencimento)::int   AS referencia_ano,
  b.linha_digitavel,
  NULL::text                                   AS codigo_barras,
  NULL::text                                   AS boleto_url,
  NULL::text                                   AS descricao,
  b.created_at                                 AS criado_em,
  b.lote_id,
  b.matricula
FROM public.cobranca_csv_boletos b;

GRANT SELECT ON public.cobrancas_unificadas TO authenticated, anon;