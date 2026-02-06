

## Plano: Eliminar Flickering na Tela de Login

### Problema Identificado

Ao fazer login, o usuário vê uma sequência de telas de loading que causa o efeito de "piscar":

1. **Login.tsx** mostra loading enquanto `isSubmitting || authLoading || (user && !profile)`
2. Quando `profile` carrega, o redirect acontece
3. **ProtectedRoute** (usado pelo AppLayout) mostra **outro loading** enquanto `!initialized || loading`
4. Finalmente, o Dashboard aparece

Isso cria uma transição brusca: `Loading do Login` → `Flash do formulário` → `Loading do AppLayout` → `Dashboard`

### Causa Raiz

O problema está na **desconexão entre os estados de loading**:

| Componente | Condição de Loading |
|------------|---------------------|
| Login.tsx | `authLoading \|\| isSubmitting \|\| (user && !profile)` |
| ProtectedRoute | `!initialized \|\| loading` |

Quando o Login faz o redirect, o `ProtectedRoute` ainda pode estar em loading por um breve momento, causando o flash.

### Solução Proposta

A estratégia é **manter o loading no Login até que todos os dados estejam prontos**, e então fazer o redirect para evitar qualquer tela intermediária.

---

### Alterações

**Arquivo:** `src/pages/auth/Login.tsx`

#### 1. Adicionar verificação de `initialized` na condição de loading

```typescript
// Linha 276: De
const showLoadingScreen = authLoading || isSubmitting || (user && !profile);

// Para:
const showLoadingScreen = authLoading || isSubmitting || (user && !profile) || !initialized;
```

Isso garante que o loading continue até que o AuthContext esteja completamente inicializado.

#### 2. Importar `initialized` do useAuth

```typescript
// Linha 51: De
const { signIn, user, profile, loading: authLoading, isAssociado } = useAuth();

// Para:
const { signIn, user, profile, loading: authLoading, initialized, isAssociado } = useAuth();
```

#### 3. Ajustar o useEffect de redirect para só executar quando `initialized` for `true`

```typescript
// Linha 82-97: De
useEffect(() => {
  // Só redireciona quando tiver user E profile carregado
  if (!authLoading && user && profile) {
    // ... redirect logic
  }
}, [authLoading, user, profile, isAssociado, navigate, location.search]);

// Para:
useEffect(() => {
  // Só redireciona quando o contexto estiver totalmente inicializado
  if (initialized && !authLoading && user && profile) {
    // ... redirect logic (mesma lógica atual)
  }
}, [initialized, authLoading, user, profile, isAssociado, navigate, location.search]);
```

---

### Fluxo Corrigido

```text
ANTES (Com Flickering):
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Formulário │ → │ Loading     │ → │ Flash       │ → │ Loading     │ → Dashboard
│  de Login   │    │ Login       │    │ Formulário  │    │ ProtectedR. │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

DEPOIS (Sem Flickering):
┌─────────────┐    ┌─────────────────────────────────┐    ┌─────────────┐
│  Formulário │ → │ Loading (mantém até initialized) │ → │  Dashboard  │
│  de Login   │    │ "Carregando dados..."           │    │             │
└─────────────┘    └─────────────────────────────────┘    └─────────────┘
```

---

### Resumo das Alterações

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/pages/auth/Login.tsx` | 51 | Adicionar `initialized` ao destructuring do `useAuth()` |
| `src/pages/auth/Login.tsx` | 82-97 | Adicionar `initialized` como condição no `useEffect` de redirect |
| `src/pages/auth/Login.tsx` | 276 | Adicionar `!initialized` à condição `showLoadingScreen` |

---

### Resultado Esperado

Após a implementação:
- O loading do Login será mantido **até que o AuthContext esteja 100% inicializado**
- O redirect só acontecerá quando todos os dados estiverem prontos
- Não haverá transição intermediária ou "piscar" da tela de login
- A experiência será uma transição suave: `Login → Loading → Dashboard`

