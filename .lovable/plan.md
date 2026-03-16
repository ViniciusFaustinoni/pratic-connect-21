

# Causa real: `onAuthStateChange` recarrega tudo para o MESMO usuário

## Evidência concreta dos logs

```
17:37:22 [AuthContext] Auth state changed: { event: "SIGNED_IN", newUserId: "4218616b" }
17:37:46 [AuthContext] Auth state changed: { event: "SIGNED_IN", newUserId: "4218616b" }
17:37:52 [AuthContext] Auth state changed: { event: "SIGNED_IN", newUserId: "4218616b" }
17:38:54 [AuthContext] Auth state changed: { event: "SIGNED_IN", newUserId: "4218616b" }
```

O Supabase dispara `SIGNED_IN` repetidamente para o **mesmo usuário** ao trocar de aba (refresh de token). Cada vez que isso acontece:

## O que acontece no código (AuthContext.tsx linhas 198-204)

```typescript
if (currentSession?.user) {
  setLoading(true);         // ← PROBLEMA: ProtectedRoute desmonta a página inteira
  hasLoadedData = false;     // ← PROBLEMA: força recarregar profile + perfis
  setTimeout(async () => {
    await loadUserData(currentSession);  // ← busca tudo de novo desnecessariamente
  }, 0);
}
```

O código **não verifica se é o mesmo usuário já carregado**. A proteção na linha 184 só bloqueia troca para OUTRO usuário, mas o mesmo usuário passa direto.

## Cascata do "reload"

1. `setLoading(true)` → `ProtectedRoute` renderiza tela de "Carregando..." (desmonta a página atual)
2. `loadUserData` busca profile + perfis no Supabase (novamente)
3. `setLoading(false)` → `ProtectedRoute` remonta toda a árvore
4. `useRouteGuard` reavalia e pode redirecionar para rota inicial
5. Realtime listeners são destruídos e recriados (visível nos logs: "Removendo listeners realtime" / "Iniciando listeners realtime")

Session replay confirma: loader aparece repetidamente em 17:37:22, 17:37:46, 17:37:52.

## Correção

**Arquivo único**: `src/contexts/AuthContext.tsx`, linhas 192-212

Adicionar verificação: se o evento é para o mesmo usuário que já está carregado, apenas atualizar `session` silenciosamente sem religar loading nem recarregar dados:

```typescript
// Se é o mesmo usuário já carregado, apenas atualizar session sem reload
if (currentUserId === newUserId && profile) {
  setSession(currentSession);
  setUser(currentSession?.user ?? null);
  return; // NÃO religar loading, NÃO recarregar profile/perfis
}

// Novo usuário ou primeiro login — fazer bootstrap completo
setSession(currentSession);
setUser(currentSession?.user ?? null);
setLoading(true);
hasLoadedData = false;
setTimeout(async () => {
  if (!mounted) return;
  await loadUserData(currentSession);
}, 0);
```

A verificação usa `currentUserId === newUserId` (que já existe no código) combinada com a existência de `profile` (garante que os dados já foram carregados). Isso quebra o ciclo sem afetar o login inicial nem a troca real de usuário.

## Impacto

- Zero reloads ao trocar de aba
- Zero reloads ao minimizar/restaurar
- Login inicial continua funcionando normalmente
- Troca de usuário (logout + login outro) continua funcionando
- Listeners realtime param de ser destruídos/recriados desnecessariamente

