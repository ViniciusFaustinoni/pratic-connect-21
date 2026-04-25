
-- Correção retroativa: cobranças importadas do SGA Hinova com valor 100x maior
-- (causado por bug no parser toNumber que removia o ponto decimal de "561.40" → 56140)

-- 1) Corrige `valor` em todos os boletos onde o JSON original tem valor_boleto
--    e o valor armazenado é exatamente 100x o valor real.
UPDATE public.cobrancas
SET valor = ROUND(valor / 100.0, 2),
    updated_at = now()
WHERE descricao LIKE 'Boleto Hinova%'
  AND dados_brutos_sga ? 'valor_boleto'
  AND ROUND(valor / 100.0, 2) = (dados_brutos_sga->>'valor_boleto')::numeric;

-- 2) Corrige `valor_final` para os mesmos registros (quando estiver afetado).
UPDATE public.cobrancas
SET valor_final = ROUND(valor_final / 100.0, 2),
    updated_at = now()
WHERE descricao LIKE 'Boleto Hinova%'
  AND valor_final IS NOT NULL
  AND dados_brutos_sga ? 'valor_boleto'
  AND ROUND(valor_final / 100.0, 2) = (dados_brutos_sga->>'valor_boleto')::numeric;

-- 3) Corrige `valor_pago` apenas onde o JSON evidencia o bug x100
--    (compara contra valor_pagamento original do Hinova).
UPDATE public.cobrancas
SET valor_pago = ROUND(valor_pago / 100.0, 2),
    updated_at = now()
WHERE descricao LIKE 'Boleto Hinova%'
  AND valor_pago IS NOT NULL
  AND dados_brutos_sga->>'valor_pagamento' IS NOT NULL
  AND dados_brutos_sga->>'valor_pagamento' NOT IN ('0,00','0.00','0','')
  AND ROUND(valor_pago / 100.0, 2) =
      REPLACE(REPLACE(dados_brutos_sga->>'valor_pagamento', '.', ''), ',', '.')::numeric;
