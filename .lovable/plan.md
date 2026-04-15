

## Plano: Corrigir erro "value too long" ao duplicar linha

### Problema

O slug gerado na duplicação (`${lineData.slug}-copia-${Date.now()}`) ultrapassa o limite de 50 caracteres da coluna `slug` em `product_lines`. Ex: `lancamento-copia-1713218895123` = 31 chars, mas slugs originais mais longos facilmente excedem 50.

### Correção

**Arquivo: `src/hooks/usePlansAdmin.ts`** — linha 1068

Truncar o slug para caber em 50 caracteres:

```typescript
slug: `${lineData.slug.slice(0, 30)}-${Date.now().toString(36)}`,
```

Usar `Date.now().toString(36)` (base36, ~8 chars) em vez de decimal (~13 chars), e limitar o slug original a 30 chars, garantindo que o resultado nunca exceda 50.

