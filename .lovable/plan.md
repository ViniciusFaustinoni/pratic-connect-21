
# Plano: Corrigir Acesso do Perfil Agência — Loop Infinito + Layout Dedicado

## Problema Raiz

O tipo `agencia` não é tratado em nenhum ponto do fluxo de autenticação:

```text
Login → tipo 'agencia' cai no else → /dashboard
/dashboard está dentro do AppLayout → allowedTipos=['funcionario']
ProtectedRoute rejeita → redireciona para /auth
/auth detecta user logado → /dashboard
→ LOOP INFINITO (tela piscando)
```

## Solução em 4 partes

### 1. Criar `AgenciaLayout` — layout dedicado para agência

Novo arquivo `src/components/layout/AgenciaLayout.tsx`:
- `ProtectedRoute` com `allowedTipos={['agencia']}`
- Layout limpo: header com logo + nome da agência + logout
- Sem sidebar (agência tem acesso restrito)
- Sem `useRouteGuard` (que forçaria redirect para módulos que agência não tem)

### 2. Mover rota `/agencia` para fora do `AppLayout`

Em `App.tsx`:
- Remover `<Route path="/agencia">` de dentro do `AppLayout`
- Criar rota separada com o novo `AgenciaLayout`:

```text
<Route element={<AgenciaLayout />}>
  <Route path="/agencia" element={<AgenciaDashboard />} />
</Route>
```

### 3. Corrigir redirects de login para tipo `agencia`

Adicionar tratamento em 4 arquivos:

| Arquivo | Mudança |
|---|---|
| `src/pages/auth/Login.tsx` (linha 86-88) | Antes do fallback `/dashboard`, checar `profile.tipo === 'agencia'` → `/agencia` |
| `src/pages/auth/AuthCallback.tsx` (linha 127) | Adicionar `else if (profile.tipo === 'agencia')` → `/agencia` |
| `src/pages/auth/DefinirSenha.tsx` (linhas 69, 119) | Adicionar agencia ao ternário de destino |
| `src/components/ProtectedRoute.tsx` (linha 60-68) | Adicionar `agencia` ao type union + redirect para `/agencia` |

### 4. ProtectedRoute — reconhecer tipo `agencia`

Na linha 60, o cast é `'funcionario' | 'associado' | 'prestador'` — adicionar `'agencia'`.
Na cascata de redirects (linhas 62-68), adicionar:
```typescript
} else if (userTipo === 'agencia') {
  return <Navigate to="/agencia" replace />;
}
```

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `src/components/layout/AgenciaLayout.tsx` | **Novo** — layout dedicado com ProtectedRoute |
| `src/App.tsx` | Mover rota `/agencia` para layout dedicado |
| `src/pages/auth/Login.tsx` | Redirect agência → `/agencia` |
| `src/pages/auth/AuthCallback.tsx` | Redirect agência → `/agencia` |
| `src/pages/auth/DefinirSenha.tsx` | Redirect agência → `/agencia` |
| `src/components/ProtectedRoute.tsx` | Adicionar `agencia` ao tipo + redirect |
