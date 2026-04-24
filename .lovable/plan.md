## Diagnóstico

Vendedores como **MARIA GLEICIELE BATISTA DOS SANTOS** aparecem com perfil `Supervisor de Vendas` em **Usuários e Acessos**, mas somem na tela de **Hierarquia de Comissões**.

### Causa raiz

Bug em `src/hooks/useAtribuicaoComissoes.ts` (função `useUsuariosVendas`, linha 35):

```ts
const userIds = Array.from(new Set((roles || []).map(r => r.user_id))); // ← auth.users.id
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, nome, email, avatar_url')
  .in('id', userIds); // ❌ filtrando profiles.id por auth.users.id
```

`user_roles.user_id` aponta para `auth.users.id` (que corresponde a `profiles.user_id`), **não** a `profiles.id`. O filtro só "casa" por coincidência quando `profiles.id == profiles.user_id`. Confirmado em DB:

| Usuário | profile.id | profile.user_id | Aparece? |
|---|---|---|---|
| Rogério Jotta | `e495f375…` | `e495f375…` (igual) | ✅ |
| Supervisor [teste] | `a549b8bd…` | `a549b8bd…` (igual) | ✅ |
| Maria Gleiciele | `ceaa9ea5…` | `5c8f8a45…` (diferente) | ❌ |
| Joanna | `bd5d987d…` | `b38f2395…` (diferente) | ❌ aparece o homônimo legado |

Pior ainda: existe um perfil legado de associado homônimo da Joanna cujo `id == user_id` — o filtro errado pega o **perfil errado** em casos de homonímia.

A convenção correta do schema é: `hierarquia_vendas.vendedor_id`, `usuario_grade_comissao.user_id` e o parâmetro `p_vendedor_id` da RPC armazenam **`profile.id`** (confirmado em `fn_auditoria_profile_snapshot`, que faz `WHERE profiles.id = p_profile_id`).

## O que vai mudar

### Único arquivo: `src/hooks/useAtribuicaoComissoes.ts` (função `useUsuariosVendas`)

1. Trocar `.in('id', userIds)` por `.in('user_id', authUserIds)` (filtro correto).
2. Adicionar `.neq('tipo', 'associado')` na busca de profiles — segurança extra para que associados nunca apareçam na esteira de comissão (nem mesmo se algum profile legado tiver role indevida).
3. Agrupar roles por `auth.user_id` e mapear para o `profile` certo via `profile.user_id`.
4. Usar `profile.id` como chave canônica retornada (compatível com tudo que já existe nas queries de `hierarquia_vendas` e `usuario_grade_comissao`).
5. Filtrar usuários sem nenhuma role após o agrupamento (defensivo).

```ts
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, user_id, nome, email, avatar_url, tipo')
  .in('user_id', authUserIds)
  .neq('tipo', 'associado');

const rolesByAuthUser = new Map<string, string[]>();
roles.forEach(r => {
  const arr = rolesByAuthUser.get(r.user_id) || [];
  arr.push(r.role);
  rolesByAuthUser.set(r.user_id, arr);
});

return profiles.map(p => ({
  id: p.id, // profile.id (chave canônica em hierarquia_vendas/usuario_grade_comissao)
  nome: p.nome || '(sem nome)',
  email: p.email || '',
  avatar_url: p.avatar_url,
  roles: rolesByAuthUser.get(p.user_id) || [],
})).filter(u => u.roles.length > 0);
```

## O que NÃO muda

- Nenhuma migration. Os dados em `hierarquia_vendas` e `usuario_grade_comissao` já estão corretos (usam `profile.id`).
- Nenhuma RPC alterada (`fn_upsert_hierarquia_vendedor`, `fn_atribuir_grade_usuario`).
- Nenhum outro componente.

## Resultado esperado

- Maria Gleiciele e todos os outros vendedores/supervisores/gerentes/agências cujo `profile.id ≠ profile.user_id` passam a aparecer na Hierarquia de Comissões.
- Casos de homonímia (associado legado com mesmo nome) deixam de "sequestrar" a linha do usuário comercial real.
- Associados (mesmo se tiverem role de vendas por engano) continuam fora da esteira de comissão.

## Pontos de atenção

- O contador "X usuário(s) ainda sem grade atribuída" no topo da tela vai aumentar — agora reflete a realidade. É correção, não regressão.
- Vou registrar memória explicitando que `profile.id` é a chave canônica em hierarquia_vendas / usuario_grade_comissao para evitar reincidência do bug.
