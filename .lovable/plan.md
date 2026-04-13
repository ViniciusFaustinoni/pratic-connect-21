

## Correção: Motor de elegibilidade não reconhece "HONDA MOTOS" nem "TODOS" como wildcard

### Problema

Em `findModelEligibility` (linha 177-178 de `useEntityEligibilityRules.ts`), a comparação usa `.includes()` na direção errada:

```typescript
const marcaOk = ctx.marca.toUpperCase().includes(entry.marca?.toUpperCase() || '');
// "HONDA".includes("HONDA MOTOS") → false ❌
```

E o modelo "TODOS" não é tratado como wildcard:
```typescript
const modeloOk = ctx.modelo.toUpperCase().includes(entry.modelo?.toUpperCase() || '');
// "CG 160 TITAN".includes("TODOS") → false ❌
```

Resultado: `findModelEligibility` retorna `null`, e como a regra é `include`, o veículo é bloqueado (linha 252: `return !isInclude` → `false`).

### Correção

**Arquivo**: `src/hooks/useEntityEligibilityRules.ts` — linhas 177-178

Duas mudanças na função `findModelEligibility`:

1. **Marca**: Comparação bidirecional — aceitar match se qualquer um contém o outro (ex: "HONDA" match "HONDA MOTOS" e vice-versa)
2. **Modelo**: Tratar "TODOS" (e variantes como "todos", "QUALQUER") como wildcard universal

```typescript
// Antes:
const marcaOk = (ctx.marca || '').toUpperCase().includes(entry.marca?.toUpperCase() || '');
const modeloOk = (ctx.modelo || '').toUpperCase().includes(entry.modelo?.toUpperCase() || '');

// Depois:
const ctxMarca = (ctx.marca || '').toUpperCase();
const entryMarca = (entry.marca || '').toUpperCase();
const marcaOk = !entryMarca || ctxMarca.includes(entryMarca) || entryMarca.includes(ctxMarca);

const ctxModelo = (ctx.modelo || '').toUpperCase();
const entryModelo = (entry.modelo || '').toUpperCase();
const modeloWildcard = ['TODOS', 'QUALQUER', 'ALL', ''].includes(entryModelo);
const modeloOk = modeloWildcard || ctxModelo.includes(entryModelo) || entryModelo.includes(ctxModelo);
```

### Escopo
- 2 linhas alteradas em 1 arquivo
- Sem deploy de Edge Function

