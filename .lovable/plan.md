

# Corrigir instalação não aparecendo no mapa de Atribuições

## Problema
A `view_vistorias_mapa` faz UNION ALL entre `vistorias` (que tem `data_agendada` como `timestamptz`) e `instalacoes`/`servicos` (que têm `data_agendada` como `date`). O PostgreSQL unifica o tipo para `timestamptz`, então o PostgREST retorna valores como `"2026-04-05T00:00:00+00:00"` em vez de `"2026-04-05"`.

No frontend (`MapaVistoriasContent.tsx`, linha 165), o código faz:
```js
const dataVistoria = new Date(v.data_agendada + 'T00:00:00');
```
Isso gera `new Date("2026-04-05T00:00:00+00:00T00:00:00")` → **Invalid Date**. A comparação `isSameDay` retorna `false` e o item é filtrado — mostrando 0 serviços.

## Solução

### `src/components/mapa/MapaVistoriasContent.tsx`

Corrigir o parsing da data na linha 165 para lidar com ambos os formatos (date string e timestamp ISO):

```typescript
// Antes:
const dataVistoria = new Date(v.data_agendada + 'T00:00:00');

// Depois:
const dateStr = v.data_agendada.split('T')[0]; // "2026-04-05T00:00:00+00:00" → "2026-04-05"
const dataVistoria = new Date(dateStr + 'T00:00:00');
```

Isso extrai apenas a parte da data (`YYYY-MM-DD`) antes de criar o objeto Date, funcionando tanto para `"2026-04-05"` quanto para `"2026-04-05T00:00:00+00:00"`.

## Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `src/components/mapa/MapaVistoriasContent.tsx` | Corrigir parsing de `data_agendada` (1 linha) |

