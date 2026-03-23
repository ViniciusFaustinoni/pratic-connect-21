

# Plano: Configurar Perfil de Agência com Acesso Restrito

## Contexto

O role `agencia` ja existe em `app_roles_config` com 41 usuarios vinculados. Porem:
- Nao esta configurado como operacional (nao tem redirect_path)
- Tem permissoes genericas (`canManageLeads`, `canViewDashboard`) que dao acesso amplo
- A rota `/perfil/conta-corrente` ja existe e funciona para vendedores
- Nao existe vinculo hierarquico agencia→vendedores (apenas `equipes_comerciais` com supervisor→vendedor)
- Nao existe pagina dedicada de dashboard para agencia

## Solucao

### 1. Migration — Tabela de vinculo agencia→vendedores + config do role

**Tabela `agencia_vendedores`**: vincula vendedores a uma agencia para que a agencia veja comissoes de todos abaixo dela.

```sql
CREATE TABLE public.agencia_vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendedor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agencia_user_id, vendedor_user_id)
);
```

**Atualizar `app_roles_config`**: marcar agencia como operacional com redirect para `/agencia`, permissoes restritas a comissoes.

```sql
UPDATE app_roles_config SET
  is_operational = true,
  redirect_path = '/agencia',
  permissions = '["canViewContaCorrente","canViewComissoesEquipe"]'::jsonb
WHERE role = 'agencia';
```

### 2. Criar pagina `/agencia` — Dashboard da Agencia

**Novo arquivo**: `src/pages/agencia/AgenciaDashboard.tsx`

Pagina com duas abas:
- **Conta Corrente**: reutiliza o mesmo hook `useContaCorrenteVendedor` com o `profile.id` da agencia logada — mostra saldo, extrato, filtros por periodo/tipo/status
- **Comissoes da Equipe**: busca comissoes de todos os vendedores vinculados via `agencia_vendedores`, mostrando tabela com nome do vendedor, valor, status, mes/ano, com totalizadores

A agencia so ve dados proprios e dos vendedores vinculados — nenhum outro modulo e acessivel.

### 3. Rota no App.tsx

Adicionar dentro do `<Route element={<AppLayout />}>`:

```tsx
<Route path="/agencia" element={<AgenciaDashboard />} />
```

### 4. Registro no MODULE_ROUTES

Em `useModuleVisibility.ts`, adicionar:

```typescript
agencia: ['/agencia', '/perfil/conta-corrente'],
```

### 5. Criar usuario fake para teste

Via insert no banco (nao no codigo):
- Criar auth user com email `agencia.teste@praticcar.org`
- Criar profile vinculado
- Atribuir role `agencia` em `user_roles`
- Vincular 2-3 vendedores existentes em `agencia_vendedores`

### 6. Sidebar — item para agencia

O `useRouteGuard` ja redireciona perfis operacionais para o `redirect_path`. O sidebar precisa mostrar apenas o item "Minha Conta" para o role agencia — isso ja e controlado por `user_module_visibility`, que sera configurado para o usuario de teste.

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| Migration SQL | Criar `agencia_vendedores`, atualizar `app_roles_config` |
| `src/pages/agencia/AgenciaDashboard.tsx` | **Novo** — dashboard com conta corrente + comissoes equipe |
| `src/App.tsx` | Adicionar rota `/agencia` |
| `src/hooks/useModuleVisibility.ts` | Adicionar `agencia` ao MODULE_ROUTES |
| Dados no banco | Usuario fake + vinculos para teste |

## O que nao muda

- Pagina de Perfis de Acesso (o role `agencia` ja aparece la)
- Formulario de usuario (ja permite atribuir role `agencia`)
- Logica de login/auth
- Conta corrente existente dos vendedores

