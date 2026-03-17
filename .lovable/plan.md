

## Plan: Replace hardcoded deságio constants with database configs

### Problem
Lines 15-16 of `usePlanosCotacao.ts` have hardcoded arrays:
```typescript
const CATEGORIAS_DESAGIO = ['chassi_remarcado', 'placa_vermelha', 'ex_taxi', 'taxi', 'leilao', 'ressarcimento_integral'];
const LINHAS_COM_DESAGIO = ['select', 'lancamento'];
```

### Changes

**1. Database migration — insert two JSON config keys**

```sql
INSERT INTO configuracoes (chave, valor, descricao, categoria)
VALUES
  ('categorias_desagio', '["chassi_remarcado","placa_vermelha","ex_taxi","taxi","leilao","ressarcimento_integral"]', 'Categorias de veículo que ativam deságio', 'cotacao'),
  ('linhas_com_desagio', '["select","lancamento"]', 'Linhas de produto com valor_desagio na tabela de preços', 'cotacao')
ON CONFLICT (chave) DO NOTHING;
```

**2. `src/hooks/usePlanosCotacao.ts`**

- Remove hardcoded constants (L15-16)
- Add two `useQuery` calls (same pattern as `regioes_com_adicional_app` at L100-112) to fetch and JSON.parse the config values, with the current arrays as fallbacks
- Update usage at L468 and L471 to reference the dynamic values instead of the removed constants

No other files change. The deságio logic (price swap + cota override) already works correctly from the previous fix — this only makes the category/line lists configurable.

### Files changed
1. Database migration: insert `categorias_desagio` and `linhas_com_desagio`
2. `src/hooks/usePlanosCotacao.ts`: replace constants with config queries

