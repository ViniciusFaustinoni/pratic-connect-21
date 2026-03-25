

# Corrigir RLS para permitir coordenador de monitoramento gerenciar equipe

## Problema
As políticas de RLS atuais usam a função `is_gerencia()` que só autoriza `diretor` e `gerente_comercial`. O coordenador de monitoramento não consegue:
1. **Atualizar profiles** (nome, telefone, regiões, etc.) dos membros da equipe
2. **Visualizar/gerenciar user_roles** para os perfis que gerencia

A criação de novos usuários funciona porque usa a Edge Function `create-user` (service role key), mas a edição/toggle de status falha por RLS.

## Solução
Criar uma função `has_permission` security definer e adicionar políticas RLS que permitam usuários com `canCreateUser` gerenciar profiles e roles dos perfis sob sua responsabilidade.

## Alterações (1 migration SQL)

### 1. Criar função `can_manage_users`
Função security definer que verifica se o usuário tem a permissão `canCreateUser` via `app_roles_config`:

```sql
CREATE FUNCTION public.can_manage_users(_user_id uuid) RETURNS boolean
SECURITY DEFINER SET search_path = public
-- Verifica se algum role do usuário possui canCreateUser nas permissions
```

### 2. Nova política em `profiles` — UPDATE
```sql
CREATE POLICY "Team managers can update profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (can_manage_users(auth.uid()))
WITH CHECK (can_manage_users(auth.uid()));
```

### 3. Nova política em `profiles` — SELECT
Expandir visibilidade para que coordenadores consigam ver os profiles da equipe:
```sql
CREATE POLICY "Team managers can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (can_manage_users(auth.uid()));
```

### 4. Novas políticas em `user_roles`
```sql
CREATE POLICY "Team managers can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (can_manage_users(auth.uid()))
WITH CHECK (can_manage_users(auth.uid()));
```

## Escopo de segurança
- A função `can_manage_users` é baseada na permissão `canCreateUser` que apenas `diretor`, `gerente_comercial` e `coordenador_monitoramento` possuem
- As políticas existentes de `is_gerencia` continuam funcionando (OR implícito entre policies no Postgres)
- Nenhuma alteração de código no frontend — apenas RLS

## Arquivo
- 1 migration SQL (função + 3 políticas)

