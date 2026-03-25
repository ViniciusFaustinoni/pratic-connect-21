

# Permitir coordenador de monitoramento alterar senha e email da equipe

## Problema
- A edge function `admin-update-email` verifica roles hardcoded (`diretor`/`admin_master`), bloqueando o coordenador de monitoramento.
- A edge function `admin-reset-password` usa `has_permission('canResetPassword')` — funciona se a permissão estiver configurada no `app_roles_config`.
- O modal de edição da Equipe (`ProfissionalModal`) não oferece campos para alterar senha ou email de profissionais existentes.

## Solução

### 1. Edge function `admin-update-email` — Usar permissão dinâmica
Substituir o check hardcoded de roles por `has_permission(user_id, 'canUpdateEmail')`, igual ao padrão já usado em `admin-reset-password`.

### 2. Migration SQL — Adicionar permissões ao coordenador
Atualizar o `app_roles_config` do `coordenador_monitoramento` para incluir `canResetPassword` e `canUpdateEmail` no array de permissions.

### 3. `ProfissionalModal.tsx` — Seção de credenciais na edição
Ao editar um profissional existente, exibir uma seção "Gerenciar Acesso" com:
- Campo para alterar email + botão "Alterar Email"
- Campo para nova senha + botão "Redefinir Senha"
- Ambos chamam as edge functions `admin-update-email` e `admin-reset-password`
- Usar o `user_id` do profissional (disponível via `ProfissionalEquipe`)

### 4. Passar `user_id` no fluxo de edição
O `ProfissionalEquipe` já tem `user_id`. Atualizar a interface `Profissional` no modal para receber `userId` quando em modo edição, e adaptar `Equipe.tsx` para passar esse dado.

## Arquivos editados
1. `supabase/functions/admin-update-email/index.ts` — trocar check de roles por `has_permission`
2. 1 migration SQL — adicionar `canResetPassword` e `canUpdateEmail` ao coordenador
3. `src/components/monitoramento/ProfissionalModal.tsx` — seção de alteração de email/senha na edição
4. `src/pages/monitoramento/Equipe.tsx` — passar `user_id` ao modal

