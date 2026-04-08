

# Plano: Garantir que o modal de editar plano exiba todos os dados configurados

## Problema

O `PlanFormModal` depende do objeto `plan` fornecido pelo componente pai, mas cada caller fornece dados em formato diferente:

1. **PlanosTab** (Admin): usa `usePlans()` que retorna `min_vehicle_year` com sufixo `+` (ex: `"2005+"`) e nao inclui `planos_coberturas`
2. **ProdutosPlanos** (Gestao Comercial): passa `selectedPlan` do `usePlans()` diretamente — mesmos problemas
3. **LinhasPlanos** (Gestao Comercial): usa `usePlansForModal()` com query separada — mapeamento melhor mas duplicado

Resultado: ao abrir o modal de edicao, campos como Ano Minimo mostram `"2005+"`, `coverage_type` pode vir vazio, e coberturas vinculadas nao aparecem.

## Solucao

Fazer o `PlanFormModal` buscar internamente os dados completos do plano pelo ID, em vez de depender do caller. O prop `plan` passa a servir apenas para fornecer o `id` — os dados reais sao buscados dentro do modal.

## Alteracoes

### 1. `PlanFormModal.tsx` — Fetch interno por ID

Adicionar uma query interna no modal:

```typescript
const { data: fullPlan } = useQuery({
  queryKey: ['plan-form-modal-data', plan?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('planos')
      .select(`*, product_lines(*), planos_beneficios(*, benefits:benefit_id(*)), planos_coberturas(*, coberturas:cobertura_id(*))`)
      .eq('id', plan!.id)
      .single();
    if (error) throw error;
    return data;
  },
  enabled: !!plan?.id && open,
});
```

Atualizar o `useEffect` de reset do form para usar `fullPlan` (dados crus do banco) em vez de `plan` (dados transformados com aliases inconsistentes). Isso garante:

- `ano_minimo` lido diretamente como numero (sem sufixo `+`)
- `ano_fabricacao_maximo` lido diretamente
- `tipo_cobertura` mapeado corretamente para `coverage_type`
- `categoria` lido diretamente
- `planos_beneficios` e `planos_coberturas` sempre disponiveis
- `desconto_percentual`, `adicional_mensal` lidos diretamente

### 2. `LinhasPlanos.tsx` — Remover `usePlansForModal`

O wrapper `PlanFormModalWrapper` e a funcao `usePlansForModal` ficam desnecessarios. Simplificar para passar apenas `{ id: planId }` como prop `plan`.

### 3. `ProdutosPlanos.tsx` — Simplificar passagem do plan

Em vez de `plan={produtoEdit as PlanWithDetails | null}`, passar apenas `plan={produtoEdit ? { id: produtoEdit.id } : null}`. O modal buscara os dados completos internamente.

## Arquivos modificados

- `src/components/admin/planos/PlanFormModal.tsx` — Adicionar fetch interno, ajustar useEffect para usar dados crus
- `src/components/gestao-comercial/LinhasPlanos.tsx` — Remover `usePlansForModal` e `PlanFormModalWrapper`
- `src/components/gestao-comercial/ProdutosPlanos.tsx` — Simplificar prop plan

