
DELETE FROM public.cobranca_csv_boletos
WHERE id = '1d526413-267f-4fcd-b359-24474be63d5c';

DROP VIEW IF EXISTS public.cobrancas_unificadas;

CREATE VIEW public.cobrancas_unificadas
WITH (security_invoker = on)
AS
SELECT
  c.id,
  'sistema'::text AS fonte,
  c.origem::text  AS origem,
  c.associado_id,
  c.veiculo_id,
  c.tipo,
  c.status,
  c.valor_final,
  c.valor_pago,
  c.data_vencimento,
  c.data_pagamento,
  c.referencia_mes,
  c.referencia_ano,
  c.linha_digitavel,
  c.created_at AS criado_em
FROM public.cobrancas c
UNION ALL
SELECT
  csv.id,
  'csv_sga'::text AS fonte,
  'sga_hinova'::text AS origem,
  csv.associado_id,
  csv.veiculo_id,
  COALESCE(csv.tipo, 'mensalidade') AS tipo,
  CASE
    WHEN csv.status_origem ILIKE 'Pago%'    THEN 'pago'
    WHEN csv.data_vencimento < CURRENT_DATE THEN 'vencido'
    ELSE 'aguardando_pagamento'
  END AS status,
  csv.valor AS valor_final,
  CASE WHEN csv.status_origem ILIKE 'Pago%' THEN csv.valor ELSE NULL END AS valor_pago,
  csv.data_vencimento,
  NULL::date AS data_pagamento,
  EXTRACT(MONTH FROM csv.data_vencimento)::int AS referencia_mes,
  EXTRACT(YEAR  FROM csv.data_vencimento)::int AS referencia_ano,
  csv.linha_digitavel,
  csv.created_at AS criado_em
FROM public.cobranca_csv_boletos csv
WHERE csv.linha_digitavel IS NULL
   OR NOT EXISTS (
     SELECT 1 FROM public.cobrancas c2
     WHERE c2.linha_digitavel = csv.linha_digitavel
   );
