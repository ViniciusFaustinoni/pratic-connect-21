

# Corrigir limite de 1000 registros na contagem de associados

## Problema
O hook `useAssociadosContagem` em `src/hooks/useAssociados.ts` faz `.select('status')` e conta os resultados com `data.length`. Como o Supabase limita a 1000 linhas por query, todas as contagens ficam erradas quando há mais de 1000 associados.

## Solução
Substituir a query única que busca todos os registros por queries individuais usando `{ count: 'exact', head: true }` — que retorna apenas a contagem sem baixar dados. Uma query por status + uma para o total.

### Arquivo: `src/hooks/useAssociados.ts` (linhas 220-252)

Substituir a queryFn por:

```ts
queryFn: async () => {
  const statuses = ['em_analise', 'aprovado', 'documentacao_pendente', 'aguardando_instalacao', 'ativo', 'inadimplente', 'suspenso', 'cancelado', 'bloqueado'] as const;

  const [totalRes, ...statusRes] = await Promise.all([
    supabase.from('associados').select('*', { count: 'exact', head: true }),
    ...statuses.map(s =>
      supabase.from('associados').select('*', { count: 'exact', head: true }).eq('status', s)
    ),
  ]);

  const contagem: ContagemAssociados = {
    total: totalRes.count || 0,
    em_analise: 0, aprovado: 0, documentacao_pendente: 0,
    aguardando_instalacao: 0, ativo: 0, inadimplente: 0,
    suspenso: 0, cancelado: 0, bloqueado: 0,
  };

  statuses.forEach((s, i) => {
    contagem[s] = statusRes[i].count || 0;
  });

  return contagem;
},
```

Cada query usa `head: true` (não retorna dados, só o count header), então não há limite de 1000.

## Impacto
- 1 arquivo, ~25 linhas alteradas
- Contagens corretas independente do número de associados
- 10 queries paralelas leves (só count, sem dados)

