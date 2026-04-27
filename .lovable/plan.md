## Objetivo

Adicionar no painel **Diretor > Perfis** (`/configuracoes/usuarios-acessos?tab=visibilidade`, renderizado por `src/pages/configuracoes/Perfis.tsx`) um botão **"Deslogar todos os usuários"** que invalida todas as sessões ativas — exceto a do Diretor que executou — e registra a ação em log de auditoria.

## Comportamento

1. Botão visível apenas para perfil **Diretor**, no topo do header da tela de Perfis (ao lado dos controles existentes), em variante destrutiva (`variant="destructive"`) com ícone `LogOut`.
2. Ao clicar, abre um `AlertDialog` de confirmação: *"Tem certeza? Todos os usuários conectados serão desconectados imediatamente. Esta ação não pode ser desfeita."*
3. Ao confirmar, chama uma **Edge Function** `deslogar-todos-usuarios` que:
   - Valida que o caller é Diretor (via `has_role(auth.uid(), 'diretor')`).
   - Lista todos os `auth.users` paginadamente via `supabase.auth.admin.listUsers()`.
   - Para cada usuário **diferente do caller**, executa `supabase.auth.admin.signOut(userId, 'global')` — invalida todas as sessões/refresh tokens.
   - Registra UMA entrada em `logs_auditoria` com `acao='configuracao'`, `modulo='seguranca'`, `descricao='Logout em massa executado'`, `dados_novos={ total_afetados, executor_id, executor_nome, ip, user_agent }`.
   - Retorna `{ total_deslogados }`.
4. Frontend mostra toast de sucesso com o número de usuários deslogados; o Diretor permanece logado normalmente.
5. No próximo request dos usuários afetados, o refresh token virá inválido (já observamos esse erro nos auth-logs como `refresh_token_not_found`) e o `AuthContext` os redireciona ao login — comportamento já existente.

## Mudanças técnicas

**Backend (Edge Function nova)** — `supabase/functions/deslogar-todos-usuarios/index.ts`
- Usa `SUPABASE_SERVICE_ROLE_KEY` (já disponível em edge functions) para criar admin client.
- Cria também client anon a partir do `Authorization` header para identificar o caller via `auth.getUser()`.
- Verifica role 'diretor' via consulta direta na tabela `user_roles` com service role.
- Itera `listUsers({ page, perPage: 1000 })` até esgotar; chama `admin.signOut(id, 'global')` para cada `id !== caller.id`.
- Insere em `logs_auditoria` com `usuario_id=caller.id`, `usuario_nome` (de `profiles`), `ip_address`/`user_agent` extraídos dos headers.
- Retorna `{ ok: true, total_deslogados, total_processados }`.
- CORS padrão do projeto.

**Frontend** — `src/pages/configuracoes/Perfis.tsx`
- Importar `AlertDialog*`, `Button`, `LogOut` icon, `supabase`, `toast`, `useAuth`.
- Adicionar componente local `DeslogarTodosButton` renderizado apenas se `perfis.includes('diretor')`.
- Estado `loading` durante a chamada; desabilita botão e mostra spinner.
- Chama `supabase.functions.invoke('deslogar-todos-usuarios')` e exibe toast com o total.
- Posicionar no topo da página (header acima das Tabs).

**Sem mudanças de schema** — `logs_auditoria` já existe e suporta `acao='configuracao'` + `modulo='seguranca'`. Sem migrations.

## Segurança

- Edge function valida role server-side (não confia no frontend).
- `service_role_key` permanece apenas na edge function.
- Auto-exclusão do caller garante que o Diretor não se desloga.
- Log de auditoria persistente com IP, user-agent, timestamp e executor.
