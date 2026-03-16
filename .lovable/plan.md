

## Diagnóstico: Menu lateral incompleto após login

### Causa Raiz

O problema **não é de RLS** — `app_roles_config` tem política `SELECT` com `qual: true` para autenticados, então sempre retorna dados.

A causa real é uma **race condition no cache do React Query** combinada com a **ausência de limpeza de cache no logout**.

**Fluxo do bug:**

1. Usuário faz login. `onAuthStateChange(SIGNED_IN)` dispara. AuthContext carrega profile/perfis via `setTimeout`.
2. `ProtectedRoute` libera renderização quando `loading = false` e `profile` existe.
3. `AppSidebar` monta. `useAppRoles()` dispara query `['app-roles-config']` com `staleTime: 30min`.
4. **Problema:** Há um frame de render onde `isRolesConfigLoading = false` (query resolveu) e `isAuthLoading = false`, mas os `perfis` do AuthContext ainda não foram propagados para `usePermissions`. O `getPermissionsForRoles(roles)` recebe `roles = []` (estado inicial de `perfis` antes do `loadUserData` finalizar), resultando em permissões vazias.
5. O sidebar renderiza com `canManageLeads = false`, `canManageCadastro = false`, etc. — só Dashboard aparece (pois `canViewDashboard` é baseado em `profile.tipo`, não em roles).
6. Quando os `perfis` chegam no próximo render, o sidebar **deveria** re-renderizar, mas `visibleGroups` é computado como variável local (não state/memo com deps corretas), e `openGroups` já foi inicializado como `[]`.

**Segundo problema:** O `signOut` no AuthContext **não limpa o cache do React Query**. Se dados ficaram em cache com `staleTime: 30min`, um re-login dentro desse período usa dados stale sem refetch.

### Plano de Correção

#### 1. Limpar cache do React Query no logout

**Arquivo:** `src/contexts/AuthContext.tsx`

- Importar `useQueryClient` do `@tanstack/react-query`
- No `signOut`, chamar `queryClient.clear()` para resetar todo o cache
- Isso garante que re-login sempre busca dados frescos

#### 2. Garantir que `usePermissions` aguarda `perfis` estarem carregados

**Arquivo:** `src/hooks/usePermissions.ts`

- O `isAuthLoading` atual vem de `loading` do AuthContext, mas `loading` pode ser `false` enquanto `perfis` ainda é `[]` em edge cases
- Adicionar verificação: `isPermissionsLoading` também deve ser `true` se `user` existe mas `perfis` está vazio (indica que roles ainda não carregaram)

```typescript
// Antes:
isPermissionsLoading: isRolesConfigLoading || isAuthLoading,

// Depois:
isPermissionsLoading: isRolesConfigLoading || isAuthLoading || (!!user && roles.length === 0 && !profile?.tipo?.includes('associado')),
```

Isso evita que o sidebar renderize com permissões vazias. O fallback para associado é excluído porque associados legitimamente não têm roles na tabela `user_roles`.

#### 3. Invalidar queries dependentes de usuário no login

**Arquivo:** `src/contexts/AuthContext.tsx`

- Ao detectar novo login (dentro do `onAuthStateChange` quando `currentUserId` muda), invalidar queries que dependem do user ID:
  - `['module-visibility', userId]`
  - `['module-item-visibility', userId]`
  - `['app-roles-config']`

#### 4. Estabilizar `visibleGroups` no AppSidebar

**Arquivo:** `src/components/layout/AppSidebar.tsx`

- Envolver `getVisibleGroups()` em `useMemo` com dependências corretas (`permissions`, `visibleModules`, `fipeMenorAtivo`) para evitar recálculos inconsistentes e garantir que o efeito de sync (linha 630) reaja corretamente quando os dados mudam.

### Arquivos Afetados

- `src/contexts/AuthContext.tsx` — limpar cache no logout, invalidar no login
- `src/hooks/usePermissions.ts` — guard contra perfis vazios
- `src/components/layout/AppSidebar.tsx` — memoizar visibleGroups

### Impacto

- Zero mudanças em lógica de negócio
- Corrige o bug para todos os tipos de login (senha, magic link, callback)
- Não afeta performance (cache continua funcionando, só é limpo em momentos corretos)

