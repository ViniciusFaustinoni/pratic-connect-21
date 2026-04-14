

## Plano: Ordenar cotações por ordem cronológica

### Problema
A lista de cotações usa uma "ordenação inteligente" que prioriza cotações sem lead vinculado e depois agrupa por status, relegando a ordem cronológica a critério de desempate. O usuário quer ver as cotações simplesmente por data, mais recentes primeiro.

### Solução

**Arquivo: `src/pages/vendas/Cotacoes.tsx`** (linhas 205-227)

Substituir a lógica de ordenação inteligente por ordenação cronológica simples:

```typescript
const sortedCotacoes = useMemo(() => {
  return [...filteredCotacoes].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}, [filteredCotacoes]);
```

Isso remove a priorização por status e por lead vinculado, mantendo apenas a ordenação por data decrescente (mais recentes primeiro).

