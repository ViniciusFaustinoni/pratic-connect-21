# Por que só persiste um supervisor

A função `fn_upsert_hierarquia_vendedor` existe **duplicada** no banco (overloads):

- **V1 (legado, 5 parâmetros)** — não conhece `p_supervisores`. Grava apenas o campo singular `supervisor_id` na `hierarquia_vendas` e ignora qualquer lista.
- **V2 (6 parâmetros, com `p_supervisores jsonb`)** — grava na tabela N:N `hierarquia_vendas_supervisores` (que é a usada pela leitura `useSupervisoresVendedor`).

O frontend chama via PostgREST (`supabase.rpc(...)`). Quando há overloads ambíguos, o PostgREST acaba resolvendo para a V1 (legada), porque `p_supervisores` chega como `null`/array vazio em alguns cenários e o resolvedor escolhe a assinatura mais simples. Resultado: a `hierarquia_vendas` é renovada com apenas o **primeiro** supervisor (coluna singular) e a tabela N:N fica vazia → ao recarregar, só aparece 1 supervisor.

# Correção

Migration única: **DROP** da função V1 (5 parâmetros), mantendo apenas a V2 (6 parâmetros, com `p_supervisores`). A V2 já cobre o caso singular (faz fallback de `p_supervisor_id` quando `p_supervisores` é nulo), então nenhum chamador legado quebra.

```sql
DROP FUNCTION IF EXISTS public.fn_upsert_hierarquia_vendedor(
  uuid, uuid, uuid, uuid, text
);
```

# Validação

1. Abrir `/comissoes/atribuicao` como diretor.
2. Editar hierarquia de um vendedor, adicionar 2 supervisores, salvar.
3. Reabrir o modal: ambos supervisores devem aparecer.
4. Conferir no banco: `select * from hierarquia_vendas_supervisores where hierarquia_id = (select id from hierarquia_vendas where vendedor_id = '...' and vigente_ate is null)` deve retornar 2 linhas.

# Arquivos afetados

- Nova migration SQL em `supabase/migrations/` removendo o overload legado.
- Nenhuma mudança de código frontend necessária (o hook `useUpsertHierarquia` já envia `p_supervisores`).
