
## Diagnóstico

Os valores "Pendente" exibidos na lista (R$ 56.140, R$ 171.594, R$ 84.040 etc.) **não são reais**. Auditoria no banco:

- **19.083 cobranças** importadas do SGA Hinova têm `valor` exatamente **100x maior** que o valor real do boleto.
- **6.543 cobranças** têm `valor_pago` também 100x maior.
- Apenas **4 registros** estão corretos.
- Soma atual no banco: **R$ 479.789.737** — soma real esperada: **~R$ 4,79 milhões**.

Exemplo confirmado (ALDA DE FATIMA — boleto `nosso_numero 781775`):
- `dados_brutos_sga.valor_boleto`: `"561.40"` (formato Hinova com ponto decimal)
- `cobrancas.valor` gravado: `56140.00` ❌
- Linha digitável confirma: `…14270000056140` → R$ 561,40
- Soma dos produtos dos 2 veículos: 280,70 + 280,70 = R$ 561,40 ✅

### Causa raiz

`supabase/functions/_shared/hinova-client.ts` linha 624 — função `toNumber`:

```ts
const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
```

Essa regra assume formato BR (`"1.234,56"`), mas a Hinova retorna alguns campos no formato **decimal com ponto** (`"561.40"`). A primeira substituição apaga o ponto decimal e o número final fica multiplicado por 100.

Campos afetados conhecidos:
- `valor_boleto` (vem como `"561.40"`)
- Eventualmente outros campos numéricos do payload Hinova que usem ponto como separador decimal.

Não afeta `valor_pagamento` quando ele já vem em formato BR (`"0,00"`), por isso só ~6.5k pagamentos foram corrompidos (apenas os que vinham com ponto).

---

## Plano de correção

### 1) Corrigir o parser `toNumber` em `_shared/hinova-client.ts`

Substituir a lógica por uma que detecte automaticamente o separador decimal:

- Se o valor já é `number` → retorna direto.
- Se a string contém vírgula → tratar como BR: remove pontos (milhar), troca vírgula por ponto.
- Se a string contém apenas ponto(s):
  - Se tiver **um único ponto** com 1–2 dígitos após → tratar como decimal (`"561.40"` = 561.40).
  - Se tiver múltiplos pontos ou 3 dígitos após o ponto → tratar como milhar (`"1.234"` = 1234) — improvável vir da Hinova, mas mantém compat.
- Sem ponto nem vírgula → `parseInt`.

### 2) Migration de correção retroativa

Criar migration que normaliza os 19.083 registros já importados:

```sql
-- Corrige valor (todos os 19.083 boletos Hinova)
UPDATE public.cobrancas
SET valor = ROUND(valor / 100.0, 2),
    updated_at = now()
WHERE descricao LIKE 'Boleto Hinova%'
  AND dados_brutos_sga ? 'valor_boleto'
  AND ROUND(valor / 100.0, 2) = (dados_brutos_sga->>'valor_boleto')::numeric;

-- Corrige valor_final quando bater com o mesmo padrão
UPDATE public.cobrancas
SET valor_final = ROUND(valor_final / 100.0, 2),
    updated_at = now()
WHERE descricao LIKE 'Boleto Hinova%'
  AND valor_final IS NOT NULL
  AND valor_final >= 1000  -- só os afetados
  AND ROUND(valor_final / 100.0, 2) <= 10000; -- sanity

-- Corrige valor_pago apenas onde realmente está x100
UPDATE public.cobrancas
SET valor_pago = ROUND(valor_pago / 100.0, 2),
    updated_at = now()
WHERE descricao LIKE 'Boleto Hinova%'
  AND valor_pago IS NOT NULL
  AND dados_brutos_sga->>'valor_pagamento' IS NOT NULL
  AND dados_brutos_sga->>'valor_pagamento' NOT IN ('0,00','0.00','0')
  AND ROUND(valor_pago / 100.0, 2) =
      REPLACE(REPLACE(dados_brutos_sga->>'valor_pagamento', '.', ''), ',', '.')::numeric;
```

A condição compara contra o `dados_brutos_sga` original — só corrige onde houver evidência clara do bug; registros já corretos ficam intactos.

### 3) Validação pós-correção

Reexecutar a auditoria SQL para confirmar:
- Soma total Hinova cai de R$ 479,7M para ~R$ 4,79M.
- Caso ALDA: `valor` = 561,40.
- Caso JANAINA (8 veículos): valor proporcional aos produtos do JSON.
- KPIs da tela `/financeiro/cobrancas` (Pago / Pendente / Vencido) refletem totais realistas.

### 4) Não é necessário re-importar

Como `dados_brutos_sga` foi preservado intacto no upsert, podemos derivar o valor correto sem nova chamada à Hinova.

---

## Detalhes técnicos

**Arquivos modificados:**
- `supabase/functions/_shared/hinova-client.ts` — função `toNumber` (linhas ~621-627).
- `supabase/migrations/<timestamp>_fix_cobrancas_hinova_valores_x100.sql` — nova migration com os 3 UPDATEs acima.

**Sem mudanças na UI:** `CobrancasList.tsx` e `CobrancaDetalhe.tsx` continuam corretos — eles apenas exibem o que está no banco. Após a migration os valores aparecerão corrigidos automaticamente.

**Re-importações futuras:** o `upsert` por `nosso_numero` na função `sga-sync-financeiro-veiculo` sobrescreverá `valor` na próxima sincronização, agora já com `toNumber` corrigido — mantém idempotência.
