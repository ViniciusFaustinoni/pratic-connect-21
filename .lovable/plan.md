

## Plano: Corrigir erro ao vincular coberturas existentes

### Problema
O insert em `planos_coberturas` inclui a coluna `display_order` que nao existe na tabela. O Supabase retorna erro 400: `Could not find the 'display_order' column of 'planos_coberturas' in the schema cache`.

### Solucao
Remover `display_order` do objeto de insert na funcao `handleAssign` (linha 339-343) e tambem em `handleCreate` (linha 261-265).

**`src/components/admin/planos/PlanCoberturasList.tsx`**

1. **handleAssign** (linha 339-343): Remover `display_order` do insert:
```ts
const inserts = selectedIds.map((coberturaId) => ({
  plano_id: planId,
  cobertura_id: coberturaId,
}));
```

2. **handleCreate** (linha 261-265): Remover `display_order` do insert:
```ts
await supabase.from('planos_coberturas').insert({
  plano_id: planId,
  cobertura_id: result.id,
});
```

### Resultado
- Vincular coberturas existentes funciona sem erro
- Criar e vincular nova cobertura tambem funciona

### Arquivo
- `src/components/admin/planos/PlanCoberturasList.tsx`

