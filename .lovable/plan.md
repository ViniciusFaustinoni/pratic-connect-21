

# Corrigir App do Associado Travado no Loading

## Problema
O `ProtectedRoute` (linha 35) tem a condição:
```typescript
if (!initialized || loading || (user && !profile))
```

Quando `initialized = true` e `loading = false`, mas o `profile` é `null` (busca falhou, perfil não existe no banco, ou erro de RLS), a condição `(user && !profile)` fica `true` **permanentemente**, resultando em spinner infinito.

O `fetchProfile` no `AuthContext` retorna `null` silenciosamente em caso de erro ou perfil inexistente, mas o `ProtectedRoute` interpreta isso como "ainda carregando".

## Causa raiz
A lógica assume que se há `user` sem `profile`, os dados ainda estão sendo buscados. Mas após `initialized = true`, isso significa que a busca **já terminou** e o perfil simplesmente não existe.

## Solução

### `src/components/ProtectedRoute.tsx`

Separar a condição de loading real da condição de "perfil inexistente":

```typescript
// Loading real — auth ainda inicializando ou dados carregando
if (!initialized || loading) {
  return <LoadingSpinner />;
}

// Não autenticado
if (!user) {
  return <Navigate to={authRedirect} ... />;
}

// Usuário autenticado mas sem perfil (perfil não existe ou falha na busca)
// Em vez de travar no spinner, redirecionar para login com mensagem
if (!profile) {
  return <Navigate to={authRedirect} state={{ error: 'profile_not_found' }} replace />;
}

// ... resto da lógica (primeiro_acesso, tipo, roles)
```

Isso garante que o app nunca fique preso em loading infinito quando o perfil não é encontrado.

## Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `src/components/ProtectedRoute.tsx` | Remover `(user && !profile)` do loading e tratar como redirect |

