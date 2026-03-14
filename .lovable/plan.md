

# Correção: Menu incompleto após login (race condition no `loading`)

## Causa raiz

O problema persiste porque a correção anterior (incluir `isAuthLoading` no `isPermissionsLoading`) não cobre o cenário de **login ativo** (quando o usuário digita email/senha e loga).

Sequência do bug:

1. Página carrega sem sessão → `loading` é setado para `false` (linha 224)
2. Usuário faz login → `onAuthStateChange(SIGNED_IN)` dispara
3. Linha 195: `setUser(session.user)` — user é preenchido imediatamente
4. Linha 198-202: `loadUserData` é agendado via `setTimeout(0)` — perfis ainda é `[]`
5. **Nesse gap**: `loading = false`, `user` existe, `perfis = []` → `isAuthLoading = false` → sidebar renderiza com menu vazio
6. `setTimeout` roda, busca perfis, mas `openGroups` já foi inicializado vazio

O `loading` nunca volta para `true` entre o login e o fetch de perfis.

## Correção

### `src/contexts/AuthContext.tsx` — Reativar loading ao receber nova sessão

Na linha 198, antes do `setTimeout`, adicionar `setLoading(true)` e resetar `hasLoadedData`:

```typescript
if (currentSession?.user) {
  setLoading(true);        // ← ADICIONAR
  hasLoadedData = false;   // ← ADICIONAR (permitir novo carregamento)
  setTimeout(async () => {
    if (!mounted) return;
    await loadUserData(currentSession);
  }, 0);
}
```

Isso garante que qualquer componente que dependa de `loading` (incluindo `isPermissionsLoading` no sidebar) mostre skeleton até os perfis serem carregados.

### Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `src/contexts/AuthContext.tsx` | Adicionar `setLoading(true)` e `hasLoadedData = false` antes do setTimeout no `onAuthStateChange` |

### Impacto

- Sidebar mostra skeleton loader durante o gap entre login e carregamento de perfis
- Quando perfis chegam, `loading` volta a `false` e o menu renderiza completo
- Nenhum outro fluxo é afetado — o `setLoading(true)` só é chamado quando há sessão válida

