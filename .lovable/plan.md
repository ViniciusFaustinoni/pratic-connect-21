

## Plano: Corrigir falta de atualização da lista de planos após alterações

### Problema
A página de gestão comercial (`/diretoria/gestao-comercial`) usa a query key `linhas_com_planos_clean` para carregar os dados. Porém, as mutations em `usePlansAdmin.ts` (criar, atualizar, toggle status, excluir) só invalidam `plans` e `planos` — nunca `linhas_com_planos_clean`. Apenas a duplicação faz a invalidação correta.

### Correção (1 arquivo)

**`src/hooks/usePlansAdmin.ts`** — adicionar `queryClient.invalidateQueries({ queryKey: ['linhas_com_planos_clean'] })` nos `onSuccess` de:

1. `useCreatePlan` (linha ~129)
2. `useUpdatePlan` (linha ~242)
3. `useTogglePlanStatus` (linha ~268)
4. `useDeletePlan` (linha ~290)

Também adicionar em `PlanoFormSheet.tsx` se já não estiver (já tem na linha 228).

### Resultado
Qualquer alteração (criar, editar, ativar/desativar, excluir) atualizará a lista automaticamente sem precisar de F5.

