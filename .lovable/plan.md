

# Correção: Filtro `visivel_gestao` ausente no motor de cotação

## Causa raiz

O hook `usePlanosCotacao.ts` (linha 115-123) busca planos com `.eq('ativo', true)` mas **não filtra por `visivel_gestao`**. Todos os outros hooks que listam planos (`usePlans.ts`, `ElegibilidadeVeiculos.tsx`) usam `.eq('visivel_gestao', true)`, mas o motor de cotação não.

Resultado: variantes internas (ex: planos com `visivel_gestao = false`) passam por todos os gates de filtragem e aparecem como opções válidas na cotação.

## Correção

**Arquivo**: `src/hooks/usePlanosCotacao.ts`, linha 122

Adicionar `.eq('visivel_gestao', true)` na query de planos:

```typescript
.eq('ativo', true)
.eq('visivel_gestao', true)   // ← adicionar
.order('ordem', { ascending: true });
```

Alteração de uma única linha. Nenhuma outra mudança necessária — os demais gates (tipo_uso, FIPE, elegibilidade, etc.) continuam funcionando normalmente sobre o conjunto filtrado.

