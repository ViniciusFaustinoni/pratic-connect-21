

## Plano: Corrigir cota do plano Elétrico e tratar `0` como valor válido

### Problema crítico

Em JavaScript, `0 || default` retorna `default` porque `0` é falsy. Com `cota_minima = 0` no plano elétrico, todos os cálculos vão ignorar o zero e usar o fallback (ex: R$1.200), cobrando indevidamente do associado.

### 1. Atualizar banco (INSERT tool)

```sql
UPDATE planos
SET cota_participacao = 10, cota_minima = 0, updated_at = NOW()
WHERE slug = 'eletrico';
```

### 2. Corrigir bug do `|| fallback` em 10 arquivos

Substituir `valor || fallback` por `valor ?? fallback` (nullish coalescing) ou `valor != null ? valor : fallback` em todos os pontos que tratam `cota_minima`:

| Arquivo | Linha(s) | Padrão atual | Correção |
|---------|----------|-------------|----------|
| `src/hooks/usePlanosCotacao.ts` | 467-468 | `Number(x) \|\| default` | `x != null ? Number(x) : default` |
| `supabase/functions/aprovar-sinistro/index.ts` | 84, 93-94 | `\|\| cotaDefault` / `\|\| minimoDefault` | `?? cotaDefault` / `?? minimoDefault` |
| `supabase/functions/autentique-webhook/index.ts` | 513-514 | `\|\| cotaDefault` / `\|\| minimoDefault` | `?? cotaDefault` / `?? minimoDefault` |
| `supabase/functions/processar-termo-evento/index.ts` | 103-104 | `\|\| 0` | `?? 0` (OK semanticamente, mas fix for consistency) |
| `supabase/functions/validar-link-evento/index.ts` | 93-94 | `\|\| 0` | `?? 0` |
| `supabase/functions/contrato-gerar/index.ts` | 611 | `\|\| null` | `?? null` |
| `supabase/functions/cron-contato-sinistro/index.ts` | 149-150 | `\|\| 0` | `?? 0` |
| `supabase/functions/_shared/termo-afiliacao-utils.ts` | 336 | `\|\| 1200` | `?? 1200` |
| `supabase/functions/_shared/termo-afiliacao-template.ts` | 545 | `\|\| 1200` | `?? 1200` |
| `supabase/functions/_shared/template-utils.ts` | 99, 101 | `\|\| 6` / `\|\| 1200` | `?? 6` / `?? 1200` |

### 3. Corrigir warning falso em `aprovar-sinistro`

Linha 84: `if (!plano.cota_participacao || !plano.cota_minima)` — `!0` é `true`, gerando warning falso para elétricos. Corrigir para:
```typescript
if (plano.cota_participacao == null || plano.cota_minima == null)
```

### 4. UI: exibir "sem mínimo" quando cota_minima é 0

- **`usePlanosCotacao.ts` linha 484**: `cotaString` mostra "mín R$ 0" — quando zero, mostrar `"${cotaPercentual}% (sem mínimo)"` em vez de `"${cotaPercentual}% (mín R$ 0)"`
- **`EventoPagamentoCota.tsx` linha 171-173**: Quando `cota.cota_minima === 0`, exibir "Sem mínimo" em vez de "R$ 0,00"

### 5. Deploy das Edge Functions afetadas

Redeployar: `aprovar-sinistro`, `autentique-webhook`, `processar-termo-evento`, `validar-link-evento`, `contrato-gerar`, `cron-contato-sinistro`

