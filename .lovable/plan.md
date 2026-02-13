
# Fix: Erro FK ao criar OS - criado_por deve referenciar profiles

## Problema
O campo `criado_por` na tabela `ordens_servico` tem uma foreign key para `profiles.id`, mas o codigo esta passando `auth.users.id` (via `user?.id`). Como `profiles.id` e `auth.users.id` sao valores diferentes, a constraint falha.

## Solucao
No `EnviarParaOficinaDialog.tsx`, buscar o `profiles.id` do usuario logado antes de inserir a OS.

## Alteracao

**Arquivo: `src/components/sinistros/EnviarParaOficinaDialog.tsx`**

Apos obter o `user` via `supabase.auth.getUser()`, buscar o perfil correspondente:

```typescript
const { data: { user } } = await supabase.auth.getUser();

// Buscar profile.id (FK exige referencia a profiles, nao auth.users)
const { data: profile } = await supabase
  .from('profiles')
  .select('id')
  .eq('user_id', user?.id)
  .maybeSingle();
```

E usar `profile?.id` no lugar de `user?.id` nos inserts:
- `criado_por: profile?.id` (insert da OS)
- `usuario_id: profile?.id` (insert do historico do sinistro)
- `usuario_id: profile?.id` (insert do historico da OS)

Mesma correcao nos 3 pontos onde `user?.id` e usado no arquivo.
