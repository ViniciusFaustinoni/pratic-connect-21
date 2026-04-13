

## Diagnóstico: Alterações não persistem em Templates e Aditivos

### Causa raiz identificada

**Templates (`documento_templates`)**: O problema é um bug de cache. Após salvar, o `onSuccess` invalida apenas a query `['documento-templates']` (listagem), mas **não invalida** a query `['documento-template', id]` (individual). Quando você volta a editar o mesmo template, o React Query serve a versão em cache (antiga) sem buscar os dados atualizados do banco.

O dado **é salvo** no banco com sucesso (confirmado pelo PATCH 200 nos logs de rede), mas a tela de edição mostra dados obsoletos do cache.

**Aditivos (`termos_aditivos`)**: O mesmo padrão pode ocorrer — preciso verificar se o `invalidateQueries` com `['termos-aditivos']` está corretamente atingindo a query individual `['termos-aditivos', id]`.

### Correções

**1. `src/hooks/useDocumentoTemplates.ts` — Corrigir invalidação de cache no `useUpdateTemplate`**
- Adicionar `queryClient.invalidateQueries({ queryKey: ['documento-template'] })` (singular) no `onSuccess`
- Isso garante que ao reabrir o template, os dados frescos sejam buscados

**2. `src/hooks/useAditivos.ts` — Verificar e corrigir invalidação de cache no `useUpdateAditivo`**
- Confirmar que `invalidateQueries({ queryKey: ['termos-aditivos'] })` atinge tanto a listagem quanto a query individual
- Se necessário, adicionar invalidação explícita

### Escopo
- 2 arquivos editados (hooks de templates e aditivos)
- Correção simples de cache invalidation

