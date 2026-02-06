
## Plano: Corrigir Flickering na Autenticação

### Diagnóstico Completo

A tela de login continua "piscando" porque há uma **race condition** entre múltiplos componentes:

| Momento | Login.tsx | ProtectedRoute | Resultado |
|---------|-----------|----------------|-----------|
| Antes do login | Mostra formulário | - | OK |
| Após signIn | `initialized=true`, `loading=false`, `user=ok`, `profile=null` | - | Deveria mostrar loading mas... |
| Navigate para /dashboard | - | Vê `initialized=true`, `loading=false` → Não mostra loading | **PROBLEMA** |
| ProtectedRoute avalia | - | `user` existe, mas `profile=null` → `userTipo=undefined` | Redirect para /auth! |
| Volta para /auth | Vê `user` mas sem `profile` | - | Pisca e tenta novamente |

### Causa Raiz

O `ProtectedRoute` (linha 34) só verifica `initialized` e `loading`:
```typescript
if (!initialized || loading) {
  return <Loading />;
}
```

Mas quando `allowedTipos` é verificado (linha 56-69), ele precisa do `profile` para saber o tipo do usuário. Se `profile` ainda for `null`, o código assume que o usuário não tem permissão e redireciona de volta para `/auth`.

### Solução

Modificar o `ProtectedRoute` para **aguardar o profile carregar** quando `allowedTipos` for especificado.

---

### Alterações

**Arquivo:** `src/components/ProtectedRoute.tsx`

#### Adicionar verificação de profile no loading state

```typescript
// Linha 33-43: De
if (!initialized || loading) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {/* ... */}
    </div>
  );
}

// Para:
// Aguardar profile carregar se temos user mas profile ainda não veio
// Isso evita decisões prematuras sobre permissões
if (!initialized || loading || (user && !profile)) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
```

---

### Fluxo Corrigido

```text
ANTES (Com Flickering):
┌─────────┐   ┌─────────────────┐   ┌────────────────────┐   ┌─────────┐
│  Login  │ → │ Navigate para   │ → │ ProtectedRoute vê  │ → │ /auth   │ → Pisca!
│ Loading │   │    /dashboard   │   │ profile=null →     │   │         │
│         │   │                 │   │ redireciona /auth  │   │         │
└─────────┘   └─────────────────┘   └────────────────────┘   └─────────┘

DEPOIS (Sem Flickering):
┌─────────┐   ┌─────────────────┐   ┌────────────────────┐   ┌───────────┐
│  Login  │ → │ Navigate para   │ → │ ProtectedRoute     │ → │ Dashboard │
│ Loading │   │    /dashboard   │   │ aguarda profile    │   │           │
│         │   │                 │   │ (mostra loading)   │   │           │
└─────────┘   └─────────────────┘   └────────────────────┘   └───────────┘
```

---

### Resumo

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/components/ProtectedRoute.tsx` | 34 | Adicionar `(user && !profile)` à condição de loading |

---

### Por que esta é a solução correta

1. **Princípio da solução**: O `ProtectedRoute` não deve tomar decisões de permissão enquanto não tiver todos os dados necessários (`profile`)

2. **Mantém a responsabilidade correta**: O `ProtectedRoute` é o componente que protege as rotas, então ele deve garantir que tem todos os dados antes de decidir

3. **Evita race conditions**: Ao aguardar o `profile`, eliminamos a possibilidade de redirecionamentos prematuros

4. **Experiência do usuário**: O usuário verá uma única tela de loading suave até chegar ao Dashboard

