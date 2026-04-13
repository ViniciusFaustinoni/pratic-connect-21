

## Plano: Corrigir filtro de perfil no hook useUsuarios

### Problema
O filtro por perfil (ex: "Diretor") é aplicado **client-side após a paginação**. O sistema busca 15 profiles, depois filtra por role — como diretores são raros entre 9756 usuários, a página retorna vazio. Os contadores de Ativos/Inativos também estão errados pois contam apenas da página atual.

### Solução
Mover o filtro de perfil para **server-side**: quando um perfil é selecionado, primeiro buscar os `user_id`s com aquele role em `user_roles`, depois filtrar `profiles` com `.in('user_id', userIds)`.

### Alterações técnicas

**1. `src/hooks/useUsuarios.ts`** (queryFn, ~linhas 56-131)
- Quando `filters.perfil` está definido e não é 'todos':
  - Primeiro query: `supabase.from('user_roles').select('user_id').eq('role', perfil)` para obter lista de user_ids
  - Adicionar `.in('user_id', userIds)` à query de profiles antes da paginação
- Remover o filtro client-side das linhas 122-126
- Isso garante que paginação e contagem (`count: 'exact'`) reflitam corretamente o filtro

**2. `src/pages/configuracoes/UsuariosAcessos.tsx`** (~linhas 189-193)
- Ajustar stats de Ativos/Inativos para usar `pagination.total` ou buscar contagem separada do servidor, em vez de contar apenas os itens da página atual

### Escopo
- 2 arquivos modificados
- Sem migrations ou Edge Functions

