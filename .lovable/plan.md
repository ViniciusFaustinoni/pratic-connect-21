## Escopo

Manter a edge `deslogar-todos-usuarios` como está (backend já invalida tokens e audita). Acoplar um **broadcast em tempo real** que faz cada cliente conectado se deslogar imediatamente, e uma **rede de segurança 401** para quem estava offline na hora.

Sem botão novo. Sem refactor de auth. Sem mexer em `getSession`/`onAuthStateChange`.

## Mudanças

### 1. `supabase/functions/deslogar-todos-usuarios/index.ts` — adicionar broadcast

Antes do retorno final (depois do `insertAuditLog`), publicar num canal Realtime `system-events`:

```ts
const channel = admin.channel('system-events');
await channel.send({
  type: 'broadcast',
  event: 'force_logout',
  payload: {
    at: new Date().toISOString(),
    by_id: callerId,
    by_nome: callerNome,
    reason: 'admin_mass_logout',
  },
});
await admin.removeChannel(channel);
```

O broadcast roda **depois** do `signOut` em massa — clientes recebem o evento e o token deles já está revogado no servidor.

### 2. Novo hook `src/hooks/useForceLogoutListener.ts`

- Cria um único canal `supabase.channel('system-events')` no mount.
- Escuta `broadcast` `event: 'force_logout'`.
- Ao receber:
  1. `queryClient.clear()` (limpa todo cache React Query).
  2. Limpa `localStorage` e `sessionStorage` preservando apenas chaves técnicas neutras (ex.: tema). Tudo de Supabase Auth (`sb-*-auth-token`) e cache de app sai.
  3. Tenta `supabase.auth.signOut({ scope: 'local' })` (best-effort, ignora erro).
  4. `window.location.replace('/login?reason=admin_logout')` — replace para não permitir voltar.
- Filtro: ignora o evento se o `payload.by_id === user?.id` (a sessão do Diretor que disparou não é encerrada).

### 3. Montar o listener no shell autenticado

Adicionar `useForceLogoutListener()` dentro do `AuthProvider` (após o estado de sessão existir), para que TODA aba autenticada do app receba o broadcast — independente da rota.

### 4. Interceptor 401 (rede de segurança offline)

Em `src/integrations/supabase/client.ts`, instrumentar o `fetch` passado ao `createClient` (já é customizado lá hoje, se não for, virar wrapper) para detectar:
- response `status === 401`, **ou**
- corpo com `{ code: 'PGRST301' }` / `JWT expired` / `invalid_token`.

Ao detectar e havendo sessão local presente, disparar uma única vez (`window.__forceLogoutInFlight` guard):
- Mesma rotina de limpeza do passo 2.
- Redirect para `/login?reason=session_expired`.

### 5. Página de login — mensagem

`src/pages/Login.tsx` (ou o componente equivalente — confirmar no momento da implementação): ler `searchParams.get('reason')` e exibir um `Alert` no topo:
- `admin_logout` → "Sua sessão foi encerrada pelo administrador. Faça login novamente para ver as informações atualizadas."
- `session_expired` → "Sua sessão expirou. Faça login novamente."

Some sozinho ao começar a digitar / após próximo login.

## O que NÃO entra

- Forçar `window.location.reload()` sem deslogar.
- Botão por-usuário ("deslogar fulano").
- Tabela nova / migration.
- Mexer em `signOut` global do supabase-js fora do listener.
- Webhook / cron extra.

## Critério de aceitação

1. Diretor clica "Deslogar todos os usuários" → em poucos segundos, todas as abas autenticadas (exceto a do próprio Diretor) caem para `/login?reason=admin_logout` com mensagem visível.
2. Após relogar, o app carrega do zero (queries refetcham, localStorage limpo) — dados aparecem atualizados.
3. Usuário offline no momento: ao voltar e fazer qualquer request, recebe 401, é redirecionado para `/login?reason=session_expired` automaticamente, sem loop.
4. `logs_auditoria` continua registrando quem disparou e quando (já implementado, sem regressão).
5. A sessão do Diretor que disparou **permanece ativa** (filtro por `by_id` no listener + `signOut` da edge já exclui o caller).

## Arquivos tocados

- `supabase/functions/deslogar-todos-usuarios/index.ts` — adicionar broadcast no canal `system-events`.
- `src/hooks/useForceLogoutListener.ts` — novo, ~60 linhas.
- `src/contexts/AuthContext.tsx` — uma linha: `useForceLogoutListener()` dentro do provider.
- `src/integrations/supabase/client.ts` — wrap do `fetch` para interceptar 401 e disparar logout local.
- `src/pages/Login.tsx` (arquivo a confirmar na implementação) — `Alert` baseado em `?reason=`.

Nenhuma migration, nenhuma tabela nova, nenhum cron.
