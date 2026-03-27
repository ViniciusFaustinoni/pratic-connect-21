

# Corrigir Duplicação de Plano: Cache + Taxa Administrativa

## Problemas

1. **Lista não atualiza** — o `onSuccess` do `useDuplicatePlan` invalida `['plans']` e `['planos']`, mas a tela de Linhas e Planos usa a query `['linhas_com_planos_clean']`, que não é invalidada.
2. **Faixas de taxa administrativa não são copiadas** — o `mutationFn` duplica benefícios e regiões, mas ignora a tabela `planos_taxa_administrativa`.

## Alterações

### `src/hooks/usePlansAdmin.ts` — função `useDuplicatePlan`

**A) Duplicar taxa administrativa** (após duplicar regiões, ~linha 368):
```ts
// Duplicate taxa administrativa
const { data: taxas } = await supabase
  .from('planos_taxa_administrativa')
  .select('fipe_de, fipe_ate, valor_taxa')
  .eq('plano_id', id);

if (taxas && taxas.length > 0) {
  await supabase.from('planos_taxa_administrativa').insert(
    taxas.map(t => ({ plano_id: createdPlan.id, fipe_de: t.fipe_de, fipe_ate: t.fipe_ate, valor_taxa: t.valor_taxa }))
  );
}
```

**B) Invalidar query correta** no `onSuccess` (~linha 373):
Adicionar:
```ts
queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] });
```

## Arquivo alterado

| Arquivo | Ação |
|---|---|
| `src/hooks/usePlansAdmin.ts` | Duplicar faixas de taxa administrativa + invalidar cache `linhas_com_planos_clean` |

