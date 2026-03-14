

# Diagnóstico: Menu lateral incompleto até recarregar a página

## Causa raiz

Existe uma **race condition** entre o carregamento dos dados de autenticação e a renderização do sidebar.

O `AppSidebar` (linha 517) calcula:
```
const isDataLoading = permissions.isPermissionsLoading || isModuleVisLoading;
```

Porém, `isPermissionsLoading` reflete **apenas** o loading do `useAppRoles` (tabela `app_roles_config`), e **não inclui** o `loading` do `AuthContext` (que busca `perfis`/roles do usuário).

Sequência do problema:
1. Usuário faz login → `AuthContext` inicia fetch de `profile` + `perfis` (roles)
2. `useAppRoles` já está em cache (staleTime 30min) → `isRolesConfigLoading = false`
3. `useModuleVisibility` depende de `user.id` e pode já ter resolvido
4. **Sidebar vê `isDataLoading = false`** enquanto `perfis` ainda é `[]`
5. Renderiza menu com permissões vazias → quase todos os itens filtrados
6. Quando `perfis` finalmente chega, o componente re-renderiza mas o estado `openGroups` já foi inicializado vazio
7. Resultado: menu incompleto até recarregar (que recarrega tudo do zero)

## Correção

### 1. `usePermissions.ts` — Incluir loading do AuthContext

Alterar `isPermissionsLoading` para incluir o estado `loading` do `AuthContext`:

```typescript
// Antes (linha 99):
const { profile, roles, hasRole, isGerencia, isVendedor, isFuncionario, user } = useAuth();

// Depois:
const { profile, roles, hasRole, isGerencia, isVendedor, isFuncionario, user, loading: isAuthLoading } = useAuth();

// Antes (linha 292):
isPermissionsLoading: isRolesConfigLoading,

// Depois:
isPermissionsLoading: isRolesConfigLoading || isAuthLoading,
```

### 2. `AppSidebar.tsx` — Sincronizar `openGroups` com dados reais

O `useState` do `openGroups` (linha 609) é inicializado uma única vez, antes dos dados reais chegarem. Adicionar um `useEffect` que re-sincronize quando `visibleGroups` mudar após o loading:

```typescript
// Adicionar após o useEffect existente (linha 626):
useEffect(() => {
  if (!isDataLoading && visibleGroups.length > 0) {
    setOpenGroups(prev => {
      const activeIds = visibleGroups
        .filter(g => isGroupActive(g.items))
        .map(g => g.id);
      const merged = [...new Set([...prev, ...activeIds])];
      return merged;
    });
  }
}, [isDataLoading, visibleGroups.length]);
```

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePermissions.ts` | Incluir `isAuthLoading` no `isPermissionsLoading` |
| `src/components/layout/AppSidebar.tsx` | Adicionar useEffect para re-sync de openGroups |

### Impacto

- O sidebar agora mostra skeleton loading enquanto perfis estão sendo carregados
- Quando os dados chegam, os grupos corretos são expandidos automaticamente
- Nenhum perfil é afetado negativamente — a mudança apenas adiciona um loading state que antes era ignorado

