
-- 1) Marca cancelamento + desativa flag global do backfill
UPDATE public.sga_runtime_state
SET backfill_cancelar_solicitado = true,
    backfill_financeiro_ativo = false,
    updated_at = now();

-- 2) Re-corrige `valor` dos boletos com bug x100 (idempotente)
UPDATE public.cobrancas
SET valor = ROUND(valor / 100.0, 2),
    updated_at = now()
WHERE descricao LIKE 'Boleto Hinova%'
  AND dados_brutos_sga ? 'valor_boleto'
  AND ROUND(valor / 100.0, 2) = (dados_brutos_sga->>'valor_boleto')::numeric
  AND valor != (dados_brutos_sga->>'valor_boleto')::numeric;

-- 3) Re-corrige `valor_final`
UPDATE public.cobrancas
SET valor_final = ROUND(valor_final / 100.0, 2),
    updated_at = now()
WHERE descricao LIKE 'Boleto Hinova%'
  AND valor_final IS NOT NULL
  AND dados_brutos_sga ? 'valor_boleto'
  AND ROUND(valor_final / 100.0, 2) = (dados_brutos_sga->>'valor_boleto')::numeric
  AND valor_final != (dados_brutos_sga->>'valor_boleto')::numeric;

-- 4) Re-corrige `valor_pago`
UPDATE public.cobrancas
SET valor_pago = ROUND(valor_pago / 100.0, 2),
    updated_at = now()
WHERE descricao LIKE 'Boleto Hinova%'
  AND valor_pago IS NOT NULL
  AND dados_brutos_sga->>'valor_pagamento' IS NOT NULL
  AND dados_brutos_sga->>'valor_pagamento' NOT IN ('0,00','0.00','0','')
  AND ROUND(valor_pago / 100.0, 2) =
      REPLACE(REPLACE(dados_brutos_sga->>'valor_pagamento', '.', ''), ',', '.')::numeric
  AND valor_pago !=
      REPLACE(REPLACE(dados_brutos_sga->>'valor_pagamento', '.', ''), ',', '.')::numeric;
