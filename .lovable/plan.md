

# Veículos via API devem ter status "ativo" em vez de "em_analise"

## Problema

No `supabase/functions/api-externa/index.ts`, linha ~200, ao criar veículos via API o status é hardcoded como `em_analise`. Como todos os veículos vindos pela API já existem no SGA, devem entrar como `ativo`.

## Alteração

| Arquivo | Ação |
|---|---|
| `supabase/functions/api-externa/index.ts` | Alterar status default de veículos de `'em_analise'` para `'ativo'` (linha ~200) |

Apenas uma linha: `status: 'em_analise'` → `status: body.status || 'ativo'` — permitindo override via payload mas defaultando para `ativo`.

