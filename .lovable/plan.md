

## Plano: Atualização local automática em todas as áreas de Linhas e Planos

### Problema
Ao salvar alterações (criar/editar/excluir linhas, duplicar linhas, criar coberturas inline), a listagem de "Linhas e Planos" não atualiza automaticamente porque vários hooks de mutação não invalidam a query key `linhas_com_planos_clean`.

### Hooks que faltam invalidar `linhas_com_planos_clean`

**`src/hooks/usePlansAdmin.ts`** — 4 hooks de product_line:
1. `useCreateProductLine` (linha 945) — só invalida `['product_lines']`
2. `useUpdateProductLine` (linha 969) — só invalida `['product_lines']`
3. `useDeleteProductLine` (linha 987) — só invalida `['product_lines']`
4. `useDuplicateProductLine` (linha 1029) — só invalida `['product_lines']`

**`src/components/admin/planos/PlanCoberturasList.tsx`** — criação inline de cobertura (linha 268) invalida apenas `['plan-coberturas-inline']` mas não `linhas_com_planos_clean` (o `invalidate()` da linha 274 faz, mas não é chamado no `handleCreateNew`).

### Correção

Adicionar `queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] })` no `onSuccess` dos 4 hooks de product_line em `usePlansAdmin.ts`, e no `handleCreateNew` de `PlanCoberturasList.tsx`.

### Arquivos alterados
- `src/hooks/usePlansAdmin.ts` — 4 edições pontuais nos `onSuccess`
- `src/components/admin/planos/PlanCoberturasList.tsx` — 1 edição no `handleCreateNew`

### Resultado
Qualquer operação (criar, editar, excluir, duplicar linha ou plano; criar cobertura inline) atualizará automaticamente a listagem sem necessidade de refresh manual.

