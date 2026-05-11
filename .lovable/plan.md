
## Diagnóstico

Reproduzi o caso do associado `viniciusfaustinoni@gmail.com` (user_id `f8bcd79c…`). Há **dois bugs combinados** que produzem o spinner eterno em `/app/login` depois que ele cria a senha pelo link público da cotação.

### Bug 1 — `profile.tipo` ficou como `funcionario` em vez de `associado`

A edge `cotacao-criar-senha` só insere o profile com `tipo: 'associado'` quando o profile **não existe**. Se um trigger do Auth (handle_new_user) já criou o profile com o default `funcionario`, a edge só faz `UPDATE { primeiro_acesso, email }` e **nunca corrige o tipo**.

Estado real no banco para esse usuário:
- `profiles.tipo = 'funcionario'`
- `auth.users.raw_user_meta_data.tipo = 'associado'`
- `user_roles.role = 'associado'`
- `associados.user_id` apontando corretamente

Como `AppLogin` só redireciona quando `profile?.tipo === 'associado'`, o usuário fica preso na tela de login.

### Bug 2 — `loading` nunca volta a `false` no `AuthContext` quando o mesmo usuário re-loga

Em `AuthContext.tsx`:
- `signIn()` faz `setLoading(true)` e **não desliga** em caso de sucesso (espera o `onAuthStateChange` chamar `loadUserData`).
- O listener tem o branch "silencioso" (linhas 242–247): se `currentUserId === newUserId` e `hasLoadedData`, ele só atualiza `session/user` e **retorna sem `setLoading(false)`**.

Cenário do usuário: ele já tinha sessão ativa (last_sign_in há minutos). Ao submeter `/app/login`:
1. `signIn` → `setLoading(true)`.
2. Supabase emite `SIGNED_IN` com o mesmo `user.id` → cai no branch silencioso → `loading` fica `true` para sempre.
3. `AppLogin` tem `if (authLoading) return <Loader />`, daí o spinner infinito visto na tela.

O log do console no print confirma: dois eventos `SIGNED_IN` consecutivos seguidos de `Mesmo usuário já carregado, atualizando session silenciosamente`.

## Correções

### 1. `supabase/functions/cotacao-criar-senha/index.ts`

No bloco que **atualiza** o profile existente (passo 5 e passo 8), forçar também:
```
tipo: 'associado',
ativo: true,
bloqueado: false,
```
para corrigir contas legadas e evitar o desvio para `/dashboard`. Manter o `INSERT` como está.

Também adicionar um upsert de role `associado` (já existe no passo 9 só para o caminho de criação) também no caminho onde `associado.user_id` já existe, garantindo que contas antigas tenham a role correta.

### 2. `src/contexts/AuthContext.tsx`

No branch silencioso do `onAuthStateChange` (linhas 242–247), além de atualizar `session/user`, garantir:
```
setLoading(false);
setInitialized(true);
```
Isso resolve o spinner eterno em qualquer fluxo onde o mesmo usuário re-autentica (login após refresh de token, signIn quando já existe sessão, etc.).

### 3. Backfill pontual do usuário afetado

Migration de dados única para corrigir profiles que já estão errados:
```sql
UPDATE profiles p
   SET tipo = 'associado'
  FROM associados a
 WHERE a.user_id = p.user_id
   AND p.tipo <> 'associado';
```
(garante que outros associados criados pelo mesmo bug também sejam consertados).

## Validação

1. Logar como diretor (`admin@teste.com`) e abrir o associado `MARCUS VINICIUS` — confirmar `profile.tipo = associado` após o backfill.
2. Tentar logar em `/app/login` com email/senha do associado — deve redirecionar para `/app/home` sem spinner travado.
3. Repetir submit estando já autenticado — `loading` deve voltar a `false` rapidamente (regressão do Bug 2).

## Arquivos alterados

- `supabase/functions/cotacao-criar-senha/index.ts` — força `tipo='associado'` no UPDATE; upsert de role no caminho "user_id já existia".
- `src/contexts/AuthContext.tsx` — `setLoading(false)` no branch silencioso.
- 1 migration SQL de backfill.
